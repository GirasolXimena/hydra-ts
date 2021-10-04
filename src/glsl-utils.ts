// converts a tree of javascript functions to a shader

// Add extra functionality to Array.prototype for generating sequences in time
import arrayUtils from './lib/array-utils';
import { TransformApplication } from './glsl-source';
import { TransformDefinitionInput } from './glsl/glsl-functions';

// [WIP] how to treat different dimensions (?)
const DEFAULT_CONVERSIONS = {
  float: {
    vec4: { name: 'sum', args: [[1, 1, 1, 1]] },
    vec2: { name: 'sum', args: [[1, 1]] },
  },
  vec4: undefined,
  sampler2D: undefined,
  texture: undefined,
} as const;

interface ShaderParams {
  uniforms: TypedArg[];
  glslFunctions: TransformApplication[];
  fragColor: string;
}

export function compileGlsl(transforms: TransformApplication[]) {
  const shaderParams: ShaderParams = {
    uniforms: [],
    glslFunctions: [],
    fragColor: '',
  };

  const gen = generateGlsl(transforms, shaderParams)('st');
  shaderParams.fragColor = gen;
  // remove uniforms with duplicate names
  let uniforms: Record<string, TypedArg> = {};
  shaderParams.uniforms.forEach((uniform) => (uniforms[uniform.name] = uniform));
  shaderParams.uniforms = Object.values(uniforms);
  return shaderParams;
}

type GlslGenerator = (uv: string) => string;

// recursive function for generating shader string from object containing functions and user arguments. Order of functions in string depends on type of function
// to do: improve variable names
function generateGlsl(
  transforms: TransformApplication[],
  shaderParams: ShaderParams,
): GlslGenerator {
  // transform function that outputs a shader string corresponding to gl_FragColor
  let fragColor: GlslGenerator = () => '';
  // var uniforms = []
  // var glslFunctions = []
  transforms.forEach((transform) => {
    let f1
    ;
    const inputs = formatArguments(transform, shaderParams.uniforms.length);
    //  console.log('inputs', inputs, transform)
    inputs.forEach((input) => {
      if (input.isUniform) shaderParams.uniforms.push(input);
    });

    // add new glsl function to running list of functions
    if (!contains(transform, shaderParams.glslFunctions))
      shaderParams.glslFunctions.push(transform);

    // current function for generating frag color shader code
    const f0 = fragColor;
    if (transform.transform.type === 'src') {
      fragColor = (uv) => `${shaderString(uv, transform.name, inputs, shaderParams)}`;
    } else if (transform.transform.type === 'coord') {
      fragColor = (uv) => `${f0(`${shaderString(uv, transform.name, inputs, shaderParams)}`)}`;
    } else if (transform.transform.type === 'color') {
      fragColor = (uv) => `${shaderString(`${f0(uv)}`, transform.name, inputs, shaderParams)}`;
    } else if (transform.transform.type === 'combine') {
      // combining two generated shader strings (i.e. for blend, mult, add funtions)
      f1 = inputs[0].value && inputs[0].value.transforms
        ? (uv: string) => `${generateGlsl(inputs[0].value.transforms, shaderParams)(uv)}`
        : inputs[0].isUniform
        ? () => inputs[0].name
        : () => inputs[0].value;
      fragColor = (uv) =>
        `${shaderString(`${f0(uv)}, ${f1(uv)}`, transform.name, inputs.slice(1), shaderParams)}`;
    } else if (transform.transform.type === 'combineCoord') {
      // combining two generated shader strings (i.e. for modulate functions)
      // eslint-disable-next-line no-redeclare
      f1 = inputs[0].value && inputs[0].value.transforms
        ? (uv: string) => `${generateGlsl(inputs[0].value.transforms, shaderParams)(uv)}`
        : inputs[0].isUniform
          ? () => inputs[0].name
          : () => inputs[0].value;
      fragColor = (uv) =>
        `${f0(
          `${shaderString(`${uv}, ${f1(uv)}`, transform.name, inputs.slice(1), shaderParams)}`,
        )}`;
    }
  });
  //  console.log(fragColor)
  //  break;
  return fragColor;
}

// assembles a shader string containing the arguments and the function name, i.e. 'osc(uv, frequency)'
function shaderString(
  uv: string,
  method: TransformApplication['name'],
  inputs: TypedArg[],
  shaderParams: ShaderParams,
) {
  const str = inputs
    .map((input) => {
      if (input.isUniform) {
        return input.name;
      } else if (input.value && input.value.transforms) {
        // this by definition needs to be a generator, hence we start with 'st' as the initial value for generating the glsl fragment
        return `${generateGlsl(input.value.transforms, shaderParams)('st')}`;
      }
      return input.value;
    })
    .reduce((p, c) => `${p}, ${c}`, '');

  return `${method}(${uv}${str})`;
}

// check whether array
function contains(object: TransformApplication, arr: TransformApplication[]) {
  for (let i = 0; i < arr.length; i++) {
    if (object.name == arr[i].name) return true;
  }
  return false;
}

function fillArrayWithDefaults(arr: any[], len: number) {
  // fill the array with default values if it's too short
  while (arr.length < len) {
    if (arr.length === 3) {
      // push a 1 as the default for .a in vec4
      arr.push(1.0);
    } else {
      arr.push(0.0);
    }
  }
  return arr.slice(0, len);
}

const ensure_decimal_dot = (val: any) => {
  val = val.toString();
  if (val.indexOf('.') < 0) {
    val += '.';
  }
  return val;
};

export interface TypedArg {
  value: TransformDefinitionInput['default'];
  type: TransformDefinitionInput['type'];
  isUniform: boolean;
  name: TransformDefinitionInput['name'];
  vecLen: number;
}

function formatArguments(transform: TransformApplication, startIndex: number): TypedArg[] {
  //  console.log('processing args', transform, startIndex)
  const defaultArgs = transform.transform.inputs;
  const userArgs = transform.userArgs;
  return defaultArgs.map((input, index) => {
    const typedArg = {
      value: input.default,
      type: input.type, //
      isUniform: false,
      name: input.name,
      vecLen: 0,
      //  compileGlsl: null // function for creating glsl
    };

    if (typedArg.type === 'float') typedArg.value = ensure_decimal_dot(input.default);
    if (input.type.startsWith('vec')) {
      try {
        typedArg.vecLen = Number.parseInt(input.type.substr(3));
      } catch (e) {
        console.log(`Error determining length of vector input type ${input.type} (${input.name})`);
      }
    }

    // if user has input something for this argument
    if (userArgs.length > index) {
      typedArg.value = userArgs[index];
      // do something if a composite or transform

      if (typeof userArgs[index] === 'function') {
        if (typedArg.vecLen > 0) {
          // expected input is a vector, not a scalar
          typedArg.value = (context, props) =>
            fillArrayWithDefaults(userArgs[index](props), typedArg.vecLen);
        } else {
          typedArg.value = (context, props) => {
            try {
              return userArgs[index](props);
            } catch (e) {
              console.log('ERROR', e);
              return input.default;
            }
          };
        }

        typedArg.isUniform = true;
      } else if (userArgs[index].constructor === Array) {
        if (typedArg.vecLen > 0) {
          // expected input is a vector, not a scalar
          typedArg.isUniform = true;
          typedArg.value = fillArrayWithDefaults(typedArg.value, typedArg.vecLen);
        } else {
          //  console.log("is Array")
          typedArg.value = (context, props) => arrayUtils.getValue(userArgs[index])(props);
          typedArg.isUniform = true;
        }
      }
    }

    if (startIndex < 0) {
      // pass
    } else {
      if (typedArg.value && typedArg.value.transforms) {
        const final_transform = typedArg.value.transforms[typedArg.value.transforms.length - 1];

        if (final_transform.transform.glsl_return_type !== input.type) {
          const defaults = DEFAULT_CONVERSIONS[input.type];
          if (typeof defaults !== 'undefined') {
            const default_def = defaults[final_transform.transform.glsl_return_type];
            if (typeof default_def !== 'undefined') {
              const { name, args } = default_def;
              typedArg.value = typedArg.value[name](...args);
            }
          }
        }

        typedArg.isUniform = false;
      } else if (typedArg.type === 'float' && typeof typedArg.value === 'number') {
        typedArg.value = ensure_decimal_dot(typedArg.value);
      } else if (
        typedArg.type.startsWith('vec') &&
        typeof typedArg.value === 'object' &&
        Array.isArray(typedArg.value)
      ) {
        typedArg.isUniform = false;
        typedArg.value = `${typedArg.type}(${typedArg.value.map(ensure_decimal_dot).join(', ')})`;
      } else if (input.type === 'sampler2D') {
        // typedArg.tex = typedArg.value
        const x = typedArg.value;
        typedArg.value = () => x.getTexture();
        typedArg.isUniform = true;
      } else {
        // if passing in a texture reference, when function asks for vec4, convert to vec4
        if (typedArg.value.getTexture && input.type === 'vec4') {
          const x1 = typedArg.value;
          // @ts-ignore
          // eslint-disable-next-line no-undef
          typedArg.value = src(x1);
          typedArg.isUniform = false;
        }
      }

      // add tp uniform array if is a function that will pass in a different value on each render frame,
      // or a texture/ external source

      if (typedArg.isUniform) {
        typedArg.name += startIndex;
        //  shaderParams.uniforms.push(typedArg)
      }
    }
    return typedArg;
  });
}
