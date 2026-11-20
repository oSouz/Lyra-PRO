'use strict';

// Prepare the next slide's effect markup without starting its animations.
globalThis.createProPresenterStage = function (build) {
  let prepared;
  return {
    prepare(text, style) {
      if (!text.trim()) {
        prepared = undefined;
      } else if (prepared?.text !== text || prepared.style !== style) {
        prepared = {text, style, content: build(text)};
      }
    },
    take(text, style) {
      if (prepared?.text !== text || prepared.style !== style) return build(text);
      const {content} = prepared;
      prepared = undefined;
      return content;
    }
  };
};
