import {
  ProcessedTransformDefinition,
  TransformDefinition,
  TransformDefinitionType,
} from './transformDefinitions.js';
import { Glsl, TransformApplication } from './Glsl';
import ImmutableList from './ImmutableList.js';
import { glsl } from 'typed-glsl';

type Constructor<T> = new (...args: any[]) => T

type Generator = (...args: unknown[]) => Glsl;

export function createTransformChainClass<
  T extends readonly TransformDefinition[]
>(modifierTransforms: T): typeof Glsl {
  let sourceClass: typeof Glsl = class extends Glsl {};

  for (const transform of modifierTransforms) {
    const processed = processGlsl(transform);
   sourceClass = addTransformChainMethod(sourceClass, processed);
  }

  return sourceClass;
}

export function createGenerator<TBase extends Constructor<Glsl>>(
  generatorTransform: TransformDefinition,
  TransformChainClass: TBase,
): Generator {
  const processed = processGlsl(generatorTransform);
  return (...args: unknown[]) => {
    const newImmutableList = new ImmutableList({
      transform: processed,
      userArgs: args
    })
    const newTransformChainClass = new TransformChainClass(newImmutableList);
    // console.table({ newImmutableList})
    return newTransformChainClass;
  }
}

export type Generators = {
  // osc: (...args: any) => Generator;
  // add: () => Generator;
  [x: string]: Generator;
} 

export function createGenerators<T extends typeof Glsl>(
  generatorTransforms: readonly TransformDefinition[],
  sourceClass: T,
): Generators {
  const generatorMap: Record<string, Generator> = {};

  for (const transform of generatorTransforms) {
    console.table(transform)
    generatorMap[transform.name] = createGenerator<typeof sourceClass>(transform, sourceClass);
  }

  return generatorMap;
}

export function addTransformChainMethod<T extends typeof Glsl>(
  cls: T,
  processedTransformDefinition: ProcessedTransformDefinition,
) {
  function addTransformApplicationToInternalChain(
    this: Glsl,
    ...args: unknown[]
  ): Glsl {
    const transform: TransformApplication = {
      transform: processedTransformDefinition,
      userArgs: args,
    } as TransformApplication;

    return new cls(this.transforms.append(transform));
  }

  // @ts-ignore
  cls.prototype[processedTransformDefinition.name] =
    addTransformApplicationToInternalChain;

  return cls
}

const typeLookup: Record<
  TransformDefinitionType,
  { returnType: string; implicitFirstArg: string }
> = {
  src: {
    returnType: 'vec4',
    implicitFirstArg: 'vec2 _st',
  },
  coord: {
    returnType: 'vec2',
    implicitFirstArg: 'vec2 _st',
  },
  color: {
    returnType: 'vec4',
    implicitFirstArg: 'vec4 _c0',
  },
  combine: {
    returnType: 'vec4',
    implicitFirstArg: 'vec4 _c0',
  },
  combineCoord: {
    returnType: 'vec2',
    implicitFirstArg: 'vec2 _st',
  },
};

export function processGlsl(
  transformDefinition: TransformDefinition,
): ProcessedTransformDefinition {
  const { implicitFirstArg, returnType } = typeLookup[transformDefinition.type];

  const signature = [
    implicitFirstArg,
    ...transformDefinition.inputs.map((input) => `${input.type} ${input.name}`),
  ].join(', ');

  const glslFunction = glsl`
  ${returnType} ${transformDefinition.name}(${signature}) {
      ${transformDefinition.glsl}
  }
`;

console.log(glslFunction)

  return {
    ...transformDefinition,
    glsl: glslFunction,
    processed: true,
  };
}
