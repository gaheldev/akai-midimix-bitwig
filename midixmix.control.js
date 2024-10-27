loadAPI(19)

host.defineController("Akai", "Akai Midimix", "0.1", "55be219b-aec4-4560-b50d-edd2d5412845", "gahel")
host.addDeviceNameBasedDiscoveryPair(["MIDI Mix"], ["MIDI Mix"])
host.defineMidiPorts(1, 1)

/* ------------------------------------------------------ */
/*                    DEBUGGING FEATURE                   */
/* ------------------------------------------------------ */
var DEBUG = false

function debug(bool = false) {
    DEBUG = bool
    return
}

/* ------------------------------------------------------ */
/*                         LOGGING                        */
/* ------------------------------------------------------ */
function log(msg) {
    if (DEBUG) { println(msg) }
}

/* ------------------------------------------------------ */
/*                       MIDI SPECS                       */
/* ------------------------------------------------------ */
const ON = 127
const OFF = 0

const NOTE_ON = 0x90
const NOTE_OFF = 0x80
const CC = 0xb0


/* ------------------------------------------------------ */
/*                          NAMES                         */
/* ------------------------------------------------------ */
const KNOB = "encoder"
const MAIN = "mainVolume"
const CHAN = "chanVolume"

// do not change those values,
// they are called like the api methods, e.g. channel.solo()
const SOLO = "solo"
const MUTE = "mute"
const RECO = "arm"


/* ------------------------------------------------------ */
/*                         CONSTS                         */
/* ------------------------------------------------------ */
var SHIFT_PRESSED = false

/* ------------------------------------------------------ */
/*                        HARDWARE                        */
/* ------------------------------------------------------ */

/* ----------------- BUTTONS RIGHT PANEL ---------------- */
const BANKL = 0x19  // 25
const BANKR = 0x1A  // 26
const SHIFT = 0x1B  // 27

/* ----------------------- ENCODER ---------------------- */
const KNOBS = {
    "30": { mode: 'send', send: 0, chan: 0 },
    "31": { mode: 'send', send: 0, chan: 1 },
    "32": { mode: 'send', send: 0, chan: 2 },
    "33": { mode: 'send', send: 0, chan: 3 },
    "34": { mode: 'send', send: 0, chan: 4 },
    "35": { mode: 'send', send: 0, chan: 5 },
    "36": { mode: 'send', send: 0, chan: 6 },
    "37": { mode: 'send', send: 0, chan: 7 },
    "38": { mode: 'send', send: 1, chan: 0 },
    "39": { mode: 'send', send: 1, chan: 1 },
    "40": { mode: 'send', send: 1, chan: 2 },
    "41": { mode: 'send', send: 1, chan: 3 },
    "42": { mode: 'send', send: 1, chan: 4 },
    "43": { mode: 'send', send: 1, chan: 5 },
    "44": { mode: 'send', send: 1, chan: 6 },
    "45": { mode: 'send', send: 1, chan: 7 },
    "46": { mode: 'pan', chan: 0 },
    "47": { mode: 'pan', chan: 1 },
    "48": { mode: 'pan', chan: 2 },
    "49": { mode: 'pan', chan: 3 },
    "50": { mode: 'pan', chan: 4 },
    "51": { mode: 'pan', chan: 5 },
    "52": { mode: 'pan', chan: 6 },
    "53": { mode: 'pan', chan: 7 }
}

/* ----------------- CHANNEL CONTROLLER ----------------- */
const CC_MAPPING = {
    [KNOB]: {
        lo: 30,
        hi: 53,
    },
    [MUTE]: {
        lo: 12,
        hi: 19
    },
    [RECO]: {
        lo: 2,
        hi: 9,
    },
    [SOLO]: {
        lo: 20,
        hi: 27,
    },
    [CHAN]: {
        lo: 92,
        hi: 99
    },
    [MAIN]: 54
}

/* ------------------------- LED ------------------------ */
const LED_MUTE = [0x01, 0x04, 0x07, 0x0A, 0x0D, 0x10, 0x13, 0x16]
const LED_RECO = [0x03, 0x06, 0x09, 0x0C, 0x0F, 0x12, 0x15, 0x18]
const LED_SOLO = [0x02, 0x05, 0x08, 0x0B, 0x0E, 0x11, 0x14, 0x17]

const LED_MAPPING = {
    [SOLO]: LED_SOLO, // row 1
    [RECO]: LED_RECO, // shift + row 1
    [MUTE]: LED_MUTE, // row 2
    [BANKL]: [0x019],
    [BANKR]: [0x01a],
}

const LED_CACHE = {
    [SOLO]: [0, 0, 0, 0, 0, 0, 0, 0],
    [MUTE]: [0, 0, 0, 0, 0, 0, 0, 0],
    [RECO]: [0, 0, 0, 0, 0, 0, 0, 0],
    [BANKL]: [0],
    [BANKR]: [0],
}

/* ------------------------------------------------------ */
/*                         HELPERS                        */
/* ------------------------------------------------------ */
function isCCRangeMapped(name, cc) {
    var map = CC_MAPPING[name]
    return (cc >= map.lo && cc <= map.hi)
}

function toggleValue(value) {
    return value === 0 ? 127 : 0
}

function toggle(val) {
    return val === 127 ? 0 : 127
}

function toBool(val) {
    return val === 127 ? true : false
}

function toMidi(bool) {
    return bool === true ? 127 : 0
}

function handleError(error) {
    println(`${error.name}: ${error.message}`)
    return
}


/* ------------------------------------------------------ */
/*                     INIT CONTROLLER                    */
/* ------------------------------------------------------ */
function init() {
    // sending to host (bitwig)
    midiIn = host.getMidiInPort(0)
    midiIn.setMidiCallback(onMidi)

    // sending to controller (midimix) -> LED
    midiOut = host.getMidiOutPort(0)

    // 8 channel faders, 2 sends, 0 scenes
    trackBank = host.createMainTrackBank(8, 2, 0)

    // make the buttons track Bitwig's state
    setButtonsObservers()

    // main fader
    mainFader = host.createMasterTrack(0)
}

function exit() {
    log("exit()")
}

/* ------------------------------------------------------ */
/*                   MIDI STATUS HANDLER                  */
/* ------------------------------------------------------ */

/* ---------------------- OBSERVERS --------------------- */
function setLED(type, index, bool) {
    try {
        const value = toMidi(bool);
        const led = LED_MAPPING[type][index];

        // Only update if there's actually a change
        if (LED_CACHE[type][index] !== value) {
            LED_CACHE[type][index] = value;
            log(`Switch LED: type=${type}, index=${index}, led=${led}, value=${value}`);
            midiOut.sendMidi(NOTE_ON, led, value);
        }
    } catch (error) {
        handleError(error);
    }
}

function setButtonsObservers() {
    log("reset observers")
    for (let i = 0; i < 8; i++) {
        const channel = trackBank.getChannel(i);

        // Clear existing observers first
        channel.mute().addValueObserver((isMuted) => {
            log(`Mute state changed for channel ${i}: ${isMuted}`);
            setLED(MUTE, i, isMuted);
        });

        // Add observer for solo state as well
        channel.solo().addValueObserver((isSoloed) => {
            log(`Solo state changed for channel ${i}: ${isSoloed}`);
            setLED(SOLO, i, isSoloed);
        });

        // Add observer for record arm state
        channel.arm().addValueObserver((isArmed) => {
            log(`Record arm state changed for channel ${i}: ${isArmed}`);
            setLED(RECO, i, isArmed);
        });
    }
}

/* ----------------------- NOTE ON ---------------------- */
function handleNoteOn(cc, value) {
    try {
        log(`handleNoteOn -> ${cc} : ${value}`)
        switch (cc) {
            case !SHIFT_PRESSED && BANKL:
                log("BANK LEFT ON")
                trackBank.scrollPageBackwards()
                setLED(BANKL, 0, true)
                break;
            case SHIFT_PRESSED && BANKL:
                log("SOLO BANK LEFT ON")
                trackBank.scrollBackwards()
                setLED(BANKL, 0, true)
                break;
            case !SHIFT_PRESSED && BANKR:
                log("BANK RIGHT ON")
                trackBank.scrollPageForwards()
                setLED(BANKR, 0, true)
                break;
            case SHIFT_PRESSED && BANKR:
                log("SOLO BANK RIGHT ON")
                trackBank.scrollForwards()
                setLED(BANKR, 0, true)
                break;
            case SHIFT:
                SHIFT_PRESSED = !SHIFT_PRESSED && cc == SHIFT
                log(`SHIFT pressed: ${SHIFT_PRESSED}`)
                break;
            default:
                break;
        }
        return
    } catch (error) {
        handleError(error)
    }
}

/* ---------------------- NOTE OFF ---------------------- */
function handleNoteOff(cc, value) {
    try {
        log(`handleNoteOff -> ${cc} : ${value}`)
        switch (cc) {
            case !SHIFT_PRESSED && BANKL:
                log("BANK LEFT OFF")
                setLED(BANKL, 0, false)
                break;
            case SHIFT_PRESSED && BANKL:
                log("SOLO BANK LEFT OFF")
                setLED(BANKL, 0, false)
                break;
            case !SHIFT_PRESSED && BANKR:
                log("BANK RIGHT OFF")
                setLED(BANKR, 0, false)
                break;
            case SHIFT_PRESSED && BANKR:
                log("SOLO BANK RIGHT OFF")
                setLED(BANKR, 0, false)
                break;
            case SHIFT:
                SHIFT_PRESSED = !SHIFT_PRESSED && cc == SHIFT
                log(`SHIFT pressed: ${SHIFT_PRESSED}`)
                break;
            default:
                break;
        }
        return
    } catch (error) {
        handleError(error)
    }
}

/* --------------------- MAIN FADER --------------------- */
function handleMainVolume(cc, value) {
    log(`Main Fader -> ${cc} : ${value}`)
    mainFader.getVolume().setRaw(value / 127)
}

/* -------------------- CHANNEL FADER ------------------- */
function handleChannelVolume(cc, value) {
    try {
        var index = cc - CC_MAPPING[CHAN].lo
        var channel = trackBank.getChannel(index)
        var volume = (value / 127) //* 0.8
        channel.getVolume().setRaw(volume)
        log(`Changing volume of channel ${index + 1} to ${value}`)
        return
    } catch (error) {
        handleError(error)
    }
}

/* ----------------------- BUTTONS ---------------------- */
function handleButton(cc, type, value) {
    try {
        if (value === ON) {
            var index = cc - CC_MAPPING[type].lo
            var channel = trackBank.getChannel(index)
            var value = toggleValue(LED_CACHE[type][index])
            channel[type]().set(toBool(value))
            log(`handleButton -> CH${index + 1} : ${type}`)
        }
        return
    } catch (error) {
        handleError(error)
    }
}

/* ---------------------- ENCODERS ---------------------- */
function handleEncoder(cc, value) {
    try {
        log(`handleEncoder -> ${cc} : ${value}`)
        var knob = KNOBS[cc]

        if (knob.mode === 'send') { send(knob.send, knob.chan, value); }
        if (knob.mode === 'pan') { pan(knob.chan, value); }

        return
    } catch (error) {
        handleError(error)
    }
}

function pan(chan_index, value) {
    var channel = trackBank.getChannel(chan_index)
    channel.pan().set(value, 128)
    return
}

function send(send_index, chan_index, value) {
    var channel = trackBank.getChannel(chan_index)
    channel.getSend(send_index).set(value, 128)
    return
}

/* ------------------------------------------------------ */
/*                   MIDI INPUT HANDLER                   */
/* ------------------------------------------------------ */
function onMidi(status, cc, value) {

    switch (true) {
        case isNoteOn(status): handleNoteOn(cc, value); break;
        case isNoteOff(status): handleNoteOff(cc, value); break;

        case isChannelController(status):
            // main volume
            if (cc === CC_MAPPING[MAIN]) { handleMainVolume(cc, value); break; }

            // channel volume
            if (isCCRangeMapped(CHAN, cc)) { handleChannelVolume(cc, value); break; }

            // buttons
            if (isCCRangeMapped(SOLO, cc)) { handleButton(cc, SOLO, value); break; }
            if (isCCRangeMapped(MUTE, cc)) { handleButton(cc, MUTE, value); break; }
            if (isCCRangeMapped(RECO, cc)) { handleButton(cc, RECO, value); break; }

            // encoders
            if (isCCRangeMapped(KNOB, cc)) { handleEncoder(cc, value); break; }

            // end
            break;

        default:
            prinltn(`UNKNOWN STATUS: ${status}, cc: ${cc}, value: ${value}`)
            break;
    }
    return
}

/* ------------------------------------------------------ */
/*                UPDATE CONTROLLER STATE                 */
/* ------------------------------------------------------ */

function flush() {
}
