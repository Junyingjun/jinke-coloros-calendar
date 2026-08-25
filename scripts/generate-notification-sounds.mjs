import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(scriptDir, "..", "android", "app", "src", "main", "res", "raw");
const sampleRate = 22050;
const sounds = {
  jinke_chime: [[659.25, 0, 0.24, 0.42], [880, 0.13, 0.36, 0.32]],
  jinke_bell: [[783.99, 0, 0.42, 0.38], [1046.5, 0.04, 0.56, 0.24]],
  jinke_glass: [[987.77, 0, 0.18, 0.33], [1318.51, 0.12, 0.36, 0.26]],
  jinke_pop: [[523.25, 0, 0.13, 0.46]],
  jinke_soft: [[440, 0, 0.28, 0.28], [554.37, 0.18, 0.42, 0.2]],
};

function makeWave(tones) {
  const duration = Math.max(...tones.map(([, start, length]) => start + length)) + 0.08;
  const sampleCount = Math.ceil(duration * sampleRate);
  const pcm = Buffer.alloc(sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    let value = 0;
    for (const [frequency, start, length, volume] of tones) {
      if (time < start || time > start + length) continue;
      const local = time - start;
      const attack = Math.min(1, local / 0.018);
      const release = Math.pow(Math.max(0, 1 - local / length), 2.3);
      value += Math.sin(2 * Math.PI * frequency * local) * attack * release * volume;
    }
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(value * 32767))), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

await mkdir(outputDir, { recursive: true });
for (const [name, tones] of Object.entries(sounds)) await writeFile(resolve(outputDir, `${name}.wav`), makeWave(tones));
console.log(`NOTIFICATION_SOUNDS_READY=${outputDir}`);
