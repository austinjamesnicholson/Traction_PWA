import test from "node:test";
import assert from "node:assert/strict";
import { prepareSaveSound, playSaveChime } from "../js/sounds.js";
test("save sound unlocks inside the gesture and plays a short quiet ascending chime", async () => {
  const notes = [],
    levels = [];
  let resumed = false;
  class Audio {
    state = "suspended";
    currentTime = 5;
    destination = {};
    resume() {
      resumed = true;
      this.state = "running";
      return Promise.resolve();
    }
    createOscillator() {
      const note = {
        frequency: {
          setValueAtTime: (value) => {
            note.hz = value;
          },
        },
        connect() {},
        start: (time) => {
          note.start = time;
        },
        stop: (time) => {
          note.stop = time;
        },
        disconnect() {},
      };
      notes.push(note);
      return note;
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime: (value) => levels.push(value),
          exponentialRampToValueAtTime() {},
        },
        connect() {},
        disconnect() {},
      };
    }
  }
  globalThis.AudioContext = Audio;
  const prepared = prepareSaveSound();
  assert(resumed);
  assert.equal(notes.length, 0);
  playSaveChime(prepared);
  await prepared.ready;
  await Promise.resolve();
  assert.equal(notes.length, 2);
  assert(notes[1].hz > notes[0].hz);
  assert(notes[1].stop - notes[0].start < 0.4);
  assert(levels.every((value) => value <= 0.05));
  delete globalThis.AudioContext;
});
test("lack of audio support does not throw or prevent saving", () => {
  delete globalThis.AudioContext;
  delete globalThis.webkitAudioContext;
  assert.doesNotThrow(() => playSaveChime(null));
});
