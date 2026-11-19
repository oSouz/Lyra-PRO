'use strict';

// Keep the next slide laid out in the same viewport as the live slide.
// Visibility preserves layout while keeping those pixels out of the output.
globalThis.createProPresenterStage = function (layers) {
  let live = layers[0];
  let prepared = layers[1];

  function write(layer, text) {
    if (layer.textContent !== text) layer.textContent = text;
  }

  return function (slide) {
    if (slide && live.textContent !== slide.current && prepared.textContent === slide.current) {
      live.classList.remove('bridge-live');
      [live, prepared] = [prepared, live];
    }
    write(live, slide?.current ?? '');
    write(prepared, slide?.next ?? '');
    live.classList.toggle('bridge-live', Boolean(slide?.current.trim()));
  };
};
