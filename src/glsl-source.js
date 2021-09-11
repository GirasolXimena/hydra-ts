"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const glsl_utils_1 = __importDefault(require("./glsl-utils"));
// const glslTransforms = require('./glsl/glsl-functions')
const utility_functions_1 = __importDefault(require("./glsl/utility-functions"));
class GlslSource {
    constructor(obj) {
        this.transforms = [];
        this.transforms.push(obj);
        this.defaultOutput = obj.defaultOutput;
        this.synth = obj.synth;
        this.type = 'GlslSource';
        this.defaultUniforms = obj.defaultUniforms;
        return this;
    }
    addTransform(obj) {
        this.transforms.push(obj);
    }
    out(_output) {
        var output = _output || this.defaultOutput;
        var glsl = this.glsl(output);
        this.synth.currentFunctions = [];
        // output.renderPasses(glsl)
        if (output)
            try {
                output.render(glsl);
            }
            catch (error) {
                console.log('shader could not compile', error);
            }
    }
    glsl(output) {
        //var output = _output || this.defaultOutput
        // uniforms included in all shaders
        //  this.defaultUniforms = output.uniforms
        var passes = [];
        var transforms = [];
        //  console.log('output', output)
        this.transforms.forEach((transform) => {
            if (transform.transform.type === 'renderpass') {
                // if (transforms.length > 0) passes.push(this.compile(transforms, output))
                // transforms = []
                // var uniforms = {}
                // const inputs = formatArguments(transform, -1)
                // inputs.forEach((uniform) => { uniforms[uniform.name] = uniform.value })
                //
                // passes.push({
                //   frag: transform.transform.frag,
                //   uniforms: Object.assign({}, self.defaultUniforms, uniforms)
                // })
                // transforms.push({name: 'prev', transform:  glslTransforms['prev'], synth: this.synth})
                console.warn('no support for renderpass');
            }
            else {
                transforms.push(transform);
            }
        });
        if (transforms.length > 0)
            passes.push(this.compile(transforms));
        return passes;
    }
    compile(transforms) {
        var shaderInfo = (0, glsl_utils_1.default)(transforms);
        var uniforms = {};
        shaderInfo.uniforms.forEach((uniform) => {
            uniforms[uniform.name] = uniform.value;
        });
        var frag = `
  precision ${this.defaultOutput.precision} float;
  ${Object.values(shaderInfo.uniforms)
            .map((uniform) => {
            let type = uniform.type;
            switch (uniform.type) {
                case 'texture':
                    type = 'sampler2D';
                    break;
            }
            return `
      uniform ${type} ${uniform.name};`;
        })
            .join('')}
  uniform float time;
  uniform vec2 resolution;
  varying vec2 uv;
  uniform sampler2D prevBuffer;

  ${Object.values(utility_functions_1.default)
            .map((transform) => {
            //  console.log(transform.glsl)
            return `
            ${transform.glsl}
          `;
        })
            .join('')}

  ${shaderInfo.glslFunctions
            .map((transform) => {
            return `
            ${transform.transform.glsl}
          `;
        })
            .join('')}

  void main () {
    vec4 c = vec4(1, 0, 0, 1);
    vec2 st = gl_FragCoord.xy/resolution.xy;
    gl_FragColor = ${shaderInfo.fragColor};
  }
  `;
        return {
            frag: frag,
            uniforms: Object.assign({}, this.defaultUniforms, uniforms),
        };
    }
}
exports.default = GlslSource;
