# akai-midimix-bitwig
Akai MIDIMIX Controller Script

# Load the scripts

1. Load the `bitwig.midimix` file into the Akai MidiMix Editor and send it to the hardware. (works through wine)
2. Copy the `midimix.control.js` file into the `Controller Scripts` in your `Bitwig Studio` folder (or where you configured it).
3. Open `Bitwig` and add the controller.

# How it's set up

This script is based on my needs. Feel free to modify it :)


#### The script provides the following functions:

- Channel faders are mapped to Track 1-8, with max values of "0 db"
- Master fader will handle the main output
- `Rec Arm` buttons are mapped to *mute* the channels (since it uses the red led, and for me red is connected to muting channels)
- The `Mute` buttons are mapped to *solo* the channels (since the yellow LED signals soloed channels for me)
- If you press `Solo` + `Mute` you are will *rec arm* the specific channel. I use the `Solo` button more like "shift".
- The `encoders` will control the FX sends, where the top row handles `FX1`, the middle row `FX2`, and the bottom row handles `FX3`.

# To do
- `Bank left` and `Bank right` are currently not used.
- If you *rec arm* the channel (solo+mute), the LEDs are currently not working

# Plans
Currently, I do not have plans to work on the script. Feel free to fork it.
