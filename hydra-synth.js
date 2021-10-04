import { Output } from './src/output';
import { Loop } from './src/loop';
import { HydraSource } from './src/hydra-source';
import ArrayUtils from './src/lib/array-utils';
import { EvalSandbox } from './src/eval-sandbox';
import { GeneratorFactory } from './src/generator-factory';
import { transforms } from './src/glsl/glsl-functions';
// to do: add ability to pass in certain uniforms and transforms
export class HydraRenderer {
    constructor({ width = 1280, height = 720, numSources = 4, numOutputs = 4, makeGlobal = true, precision = 'mediump', regl, }) {
        this.s = [];
        this.o = [];
        this.hush = () => {
            this.s.forEach((source) => {
                source.clear();
            });
            this.o.forEach((output) => {
                // TODO - should reset output directly without relying on synth
                this.synth.solid(1, 1, 1, 0).out(output);
            });
        };
        this.setResolution = (width, height) => {
            this.regl._gl.canvas.width = width;
            this.regl._gl.canvas.height = height;
            this.width = width;
            this.height = height;
            this.s.forEach((source) => {
                source.resize(width, height);
            });
            this.o.forEach((output) => {
                output.resize(width, height);
            });
            this.regl._refresh();
        };
        this.render = (output) => {
            this.output = output !== null && output !== void 0 ? output : this.o[0];
        };
        // dt in ms
        this.tick = (dt) => {
            this.sandbox.tick();
            this.sandbox.set('time', (this.synth.time += dt * 0.001 * this.synth.speed));
            this.timeSinceLastUpdate += dt;
            if (!this.synth.fps || this.timeSinceLastUpdate >= 1000 / this.synth.fps) {
                this.synth.stats.fps = Math.ceil(1000 / this.timeSinceLastUpdate);
                this.s.forEach((source) => {
                    source.tick(this.synth.time);
                });
                this.o.forEach((output) => {
                    output.tick({
                        time: this.synth.time,
                        bpm: this.synth.bpm,
                        resolution: [this.regl._gl.canvas.width, this.regl._gl.canvas.height],
                    });
                });
                this.renderFbo({
                    tex0: this.output.getCurrent(),
                    resolution: [this.regl._gl.canvas.width, this.regl._gl.canvas.height],
                });
                this.timeSinceLastUpdate = 0;
            }
        };
        ArrayUtils.init();
        this.width = width;
        this.height = height;
        this.regl = regl;
        // object that contains all properties that will be made available on the global context and during local evaluation
        this.synth = {
            time: 0,
            bpm: 30,
            width: this.width,
            height: this.height,
            fps: undefined,
            stats: {
                fps: 0,
            },
            speed: 1,
            render: this.render,
            setResolution: this.setResolution,
            hush: this.hush,
        };
        this.timeSinceLastUpdate = 0;
        this._time = 0; // for internal use, only to use for deciding when to render frames
        this.precision = precision;
        // This clears the color buffer to black and the depth buffer to 1
        this.regl.clear({
            color: [0, 0, 0, 1],
        });
        this.renderFbo = this.regl({
            frag: `
      precision ${this.precision} float;
      varying vec2 uv;
      uniform vec2 resolution;
      uniform sampler2D tex0;

      void main () {
        gl_FragColor = texture2D(tex0, vec2(1.0 - uv.x, uv.y));
      }
      `,
            vert: `
      precision ${this.precision} float;
      attribute vec2 position;
      varying vec2 uv;

      void main () {
        uv = position;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
      }`,
            attributes: {
                position: [
                    [-2, 0],
                    [0, -2],
                    [2, 2],
                ],
            },
            uniforms: {
                tex0: this.regl.prop('tex0'),
                resolution: this.regl.prop('resolution'),
            },
            count: 3,
            depth: { enable: false },
        });
        for (let i = 0; i < numSources; i++) {
            let s = new HydraSource({
                regl: this.regl,
                width: this.width,
                height: this.height,
            });
            this.synth[`s${i}`] = s;
            this.s.push(s);
        }
        for (let i = 0; i < numOutputs; i++) {
            const o = new Output({
                regl: this.regl,
                width: this.width,
                height: this.height,
                precision: this.precision,
            });
            this.synth[`o${i}`] = o;
            this.o.push(o);
        }
        this.output = this.o[0];
        this.generator = new GeneratorFactory({
            defaultOutput: this.output,
            defaultUniforms: this.output.uniforms,
            transforms,
            changeListener: ({ type, method, synth, }) => {
                if (type === 'add') {
                    this.synth[method] = synth.generators[method];
                    if (this.sandbox) {
                        this.sandbox.add(method);
                    }
                }
                else if (type === 'remove') {
                    // what to do here? dangerously deleting window methods
                    //delete window[method]
                }
            },
        });
        this.loop = new Loop(this.tick);
        // final argument is properties that the user can set, all others are treated as read-only
        this.sandbox = new EvalSandbox(this.synth, makeGlobal, ['speed', 'bpm', 'fps']);
    }
}
