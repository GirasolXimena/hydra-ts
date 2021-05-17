const { expect } = require('chai');
const { prepareForHydra, mockRegl } = require('./lib/util');

describe('Transforms', function () {
  const dimensions = {
    width: 100,
    height: 100,
  };
  let mocked;

  before(function () {
    mocked = mockRegl(dimensions);
  });
  after(function () {
    mocked.reset();
  });

  describe('src transforms', function () {
    describe('solid', function () {
      it('Fills the buffer completely with the expected value', function () {
        const { canvas } = prepareForHydra();
        const HydraSynth = require('../index');

        const hydra = new HydraSynth({ autoLoop: false, makeGlobal: false, canvas });

        hydra.synth.generators.solid(1, 0, 1, 0.5).out(hydra.o[0]);

        hydra.tick();

        const pixels = hydra.regl.read();

        for (let i = 0; i < dimensions.width * dimensions.height; i++) {
          expect(pixels[i * 4 + 0]).to.equal(255);
          expect(pixels[i * 4 + 1]).to.equal(0);
          expect(pixels[i * 4 + 2]).to.equal(255);
          expect(pixels[i * 4 + 3]).to.equal(128);
        }
      });
    });
  });
});
