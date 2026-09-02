const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const execSync = require('child_process').execSync;

execSync('ffmpeg -y -f lavfi -i aevalsrc="sin(440*2*PI*t)" -t 1 beep440.wav');
execSync('ffmpeg -y -f lavfi -i aevalsrc="sin(880*2*PI*t)" -t 1 beep880.wav');
execSync('ffmpeg -y -f lavfi -i testsrc=d=1:s=320x240 -i beep440.wav -c:v libx264 -c:a aac video_with_audio.mp4');

console.log("Created test files.");

const command = ffmpeg('video_with_audio.mp4');
command.input('beep880.wav');

let filterComplex = '[1:a]amix=inputs=1:duration=first:dropout_transition=2:normalize=0[aout]';
command.complexFilter(filterComplex, ['aout']);
command.outputOptions(['-map 0:v', '-c:v copy', '-c:a aac', '-b:a 192k']);
command.output('mixed_output.mp4');

command.on('start', (cmdline) => console.log(cmdline));
command.on('end', () => {
    console.log("Done.");
    // Check streams in output
    const out = execSync('ffprobe -v error -show_entries stream=index,codec_type -of csv=p=0 mixed_output.mp4').toString();
    console.log("Streams:\n", out);
    process.exit(0);
});
command.on('error', (err) => console.error(err));
command.run();
