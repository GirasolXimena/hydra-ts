### Hydra-Synth

Video synth engine for [hydra](https://github.com/ojack/hydra).

Currently experimental / in-progress.

This is the main logic of hydra packaged as a javascript module, intended for use within javascript projects. If you are looking to get started with hydra quickly, visit the [web editor](https://hydra.ojack.xyz) or the [main repo](https://github.com/ojack/hydra). To use hydra within atom, follow the instructions at https://github.com/ojack/hydra-examples.

![image of hydra in webpage](/assets/hydra-webpage.png?raw=true)

### To include in a webpage (bundled version):

Include the bundled version of this library in your html file:

```html
<script src="https://unpkg.com/hydra-synth"></script>
<script>
  // create a new hydra-synth instance
  var hydra = new Hydra({ detectAudio: false });
  osc(4, 0.1, 1.2).out();
</script>
```

You can see and remix a live example here: https://glitch.com/edit/#!/hydra-webpage

### To use as a module:

Download the module:

```
npm install --save hydra-synth
```

Include in your app:

```javascript
const Hydra = require('hydra-synth');

const hydra = new Hydra({ detectAudio: false });
osc(4, 0.1, 1.2).out();
```

The rest of this README is about configuring hydra-synth. For broader hydra documentation and usage, see [getting started](https://github.com/ojack/hydra#basic-functions), [interactive function documentation](https://ojack.xyz/hydra-functions/), and [Hydra Book (by Naoto Hieda)](https://hydra-book.naotohieda.com/#/).

#### API:

```javascript
const hydra = new Hydra([opts]);
```

create a new hydra instance

If `opts` is specified, the default options (shown below) will be overridden.

```javascript
{
  regl: // canvas element to render to. If none is supplied, a canvas will be created and appended to the screen

  width: // defaults to canvas width when included, 1280 if not

  height: // defaults to canvas height when included, 720 if not

  makeGlobal: true, // if false, will not pollute global namespace (note: there are currently bugs with this)

  numSources: 4, // number of source buffers to create initially

  numOutputs: 4, // number of output buffers to use. Note: untested with numbers other than 4. render() method might behave unpredictably

  precision: null  // force precision of shaders, can be 'highp', 'mediump', or 'lowp' (recommended for ios). When no precision is specified, will use highp for ios, and mediump for everything else.
}

```

#### Custom render loop

You can use your own render loop for triggering hydra updates, instead of the automatic looping. To use, set autoLoop to false, and call

```javascript
hydra.tick(dt);
```

where dt is the time elapsed in milliseconds since the last update

### To develop:

```javascript
npm run dev
```

Sets up an example using hydra-synth that is automatically updated when source files are updated. It is possible to write test code by editing /example/index.js or by writing hydra code into the developer console.

#### Non-global mode [in progress]

If makeGlobal is set to false, buffers and functions can be accessed via the synth property of the hydra instance. Note that sources and buffers are contained in an array and accessed by index. E.g.:

```javascript
let synth = hydra.synth;
synth.osc().out();
synth.s0.initCam();
```
