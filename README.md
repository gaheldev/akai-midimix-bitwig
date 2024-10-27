# akai-midimix-bitwig
Akai MIDIMIX Controller Script 

_(forked from [@mfeyx](https://github.com/mfeyx/akai-midimix-bitwig))_

# Load the scripts

1. Load the `bitwig.midimix` file into the Akai MidiMix Editor and send it to the hardware. On Linux, you can run the Editor with wine.
2. Copy the `midimix.control.js` file into the `Controller Scripts` in your `Bitwig Studio` folder (or where you configured it).
3. Open `Bitwig` and add the controller.

# How it's set up

#### The script provides the following functions:

- Channel faders are mapped to Track 1-8, with max values of "0 db"
- Master fader will handle the main output
- `Bank Left` or `Bank Right` scrolls 8 channels up/down (or left/right depending on the view)
- `Solo` + `Bank Left` or  `Solo` + `Bank Right` scrolls 1 channel up/down (or left/right depending on the view)
- `Rec Arm` buttons
- `Mute` buttons
- If you press `Solo` you will see the *solo* state of the channels
- If you press `Solo` + `Mute` you will toggle *solo* on the channel
- The `encoders` control the panning and FX sends, where the top row handles `FX1`, the middle row `FX2`, and the bottom row handles `Pan`.

It is also possible to remap any of the knobs and faders through MIDI learn.

# To do
- `Bank left` and `Bank right` could show if it is possible to scroll more by being lit
