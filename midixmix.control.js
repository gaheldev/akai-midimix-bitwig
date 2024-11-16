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
var PERSISTENT_SOLO_MODE = false // on double solo press

// everytime shift is released, we update the timestamp
var SHIFT_RELEASED_LAST_TIMESTAMP = 0
var DOUBLE_SHIFT_RELEASED_WINDOW = 500 // ms

const EXCLUSIVE_SOLO_STATES = {
    USER: 'User',
    ON: 'On',
    OFF: 'Off'
};
var EXCLUSIVE_SOLO = EXCLUSIVE_SOLO_STATES.USER;

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
const LED_BANKL = [0x019]
const LED_BANKR = [0x01a]

const LED_MAPPING = {
    [SOLO]: LED_SOLO, // shift + row 1
    [RECO]: LED_RECO, // row 2
    [MUTE]: LED_MUTE, // row 1
    [BANKL]: LED_BANKL,
    [BANKR]: LED_BANKR,
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

function getTime() {
    const d = new Date();
    return d.getTime();
}


/* ------------------------------------------------------ */
/*                     INIT CONTROLLER                    */
/* ------------------------------------------------------ */
function init() {
    // Create the persistent solo setting
    persistentSoloSetting = host.getPreferences().getBooleanSetting(
        "Swap mute and Solo buttons",
        "Solo Settings",
        false
    );

    // make the buttons track the solo mode
    setPersistentSoloSettingObserver()

    // Create the solo setting
    multiSoloSetting = host.getPreferences().getEnumSetting(
        "Exclusive Solo",
        "Solo Settings",
        Object.values(EXCLUSIVE_SOLO_STATES),
        EXCLUSIVE_SOLO
    );

    multiSoloSetting.addValueObserver(function(value) {
        if (EXCLUSIVE_SOLO !== value) {
            EXCLUSIVE_SOLO = value;
            log(`Multi Solo mode changed to: ${EXCLUSIVE_SOLO}`);
        }
    });

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
function setLED(type, index, bool, force_update=false) {
    try {
        const value = toMidi(bool);
        const led = LED_MAPPING[type][index];

        // Only update if there's actually a change
        if (LED_CACHE[type][index] !== value || force_update) {
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

function resetLEDs() {
    for (let i = 0; i < 8; i++) {
        const channel = trackBank.getChannel(i);

        setLED(MUTE, i, channel.mute().getAsBoolean(), true);
        setLED(SOLO, i, channel.solo().getAsBoolean(), true);
        setLED(RECO, i, channel.arm().getAsBoolean(), true);
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

                if (!SHIFT_PRESSED) {
                    let current_time = getTime()
                    if ((current_time - SHIFT_RELEASED_LAST_TIMESTAMP) < DOUBLE_SHIFT_RELEASED_WINDOW) {
                        togglePersistentSolo()
                    }
                    SHIFT_RELEASED_LAST_TIMESTAMP = current_time
                }

                break;
            default:
                break;
        }
        return
    } catch (error) {
        handleError(error)
    }
}

/* ------------------- PERSISTENT SOLO ------------------ */
function togglePersistentSolo() {
    // Update the preference setting instead of directly modifying PERSISTENT_SOLO_MODE
    persistentSoloSetting.set(!PERSISTENT_SOLO_MODE);
    // The value observer will handle the actual mode switch
}

function setPersistentSoloSettingObserver() {
    persistentSoloSetting.addValueObserver(function(value) {
        if (PERSISTENT_SOLO_MODE !== value) {
            PERSISTENT_SOLO_MODE = value;
            switchMappings();
            switchLEDs();
            resetLEDs();
            log(`Persistent SOLO mode changed via preferences: ${PERSISTENT_SOLO_MODE}`);
        }
    });
}

function switchMappings() {
    let cc_solo = CC_MAPPING[SOLO]
    let cc_mute = CC_MAPPING[MUTE]
    let solo_lo = cc_solo.lo
    let solo_hi = cc_solo.hi

    cc_solo.lo = cc_mute.lo
    cc_solo.hi = cc_mute.hi

    cc_mute.lo = solo_lo
    cc_mute.hi = solo_hi
}

function switchLEDs() {
    for (let i = 0; i < 8; i++) {
        let tmp = LED_SOLO[i]
        LED_SOLO[i] = LED_MUTE[i]
        LED_MUTE[i] = tmp
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
            switch (type) {
                case SOLO:
                    switch (EXCLUSIVE_SOLO) {
                        case EXCLUSIVE_SOLO_STATES.USER: channel.solo().toggleUsingPreferences(false); break;
                        case EXCLUSIVE_SOLO_STATES.ON: channel.solo().toggle(true); break;
                        case EXCLUSIVE_SOLO_STATES.OFF: channel.solo().toggle(false); break;
                    }
                default: channel[type]().set(toBool(value))
            }
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
