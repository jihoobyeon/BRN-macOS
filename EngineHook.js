import { Component, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { Color4, Tools } from '@babylonjs/core';
import { ReactNativeEngine } from './ReactNativeEngine';
import { ensureInitialized } from './BabylonModule';
import * as base64 from 'base-64';
// These are errors that are normally thrown by WebXR's requestSession, so we should throw the same errors under similar circumstances so app code can be written the same for browser or native.
// https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession
// https://developer.mozilla.org/en-US/docs/Web/API/DOMException#Error_names
var DOMError;
(function (DOMError) {
    DOMError[DOMError["NotSupportedError"] = 9] = "NotSupportedError";
    DOMError[DOMError["InvalidStateError"] = 11] = "InvalidStateError";
    DOMError[DOMError["SecurityError"] = 18] = "SecurityError";
})(DOMError || (DOMError = {}));
class DOMException {
    error;
    constructor(error) {
        this.error = error;
    }
    get code() { return this.error; }
    get name() { return DOMError[this.error]; }
}
// Requests the camera permission and throws if the permission could not be granted
async function requestCameraPermissionAsync() {
    return;
}
// Override the WebXRSessionManager.initializeSessionAsync to insert a camera permissions request. It would be cleaner to do this directly in the native XR implementation, but there are a couple problems with that:
// 1. React Native does not provide a way to hook into the permissions request result (at least on Android).
// 2. If it is done on the native side, then we need one implementation per platform.

ensureInitialized().then();

global.atob = base64.decode;
// Polyfill console.time and console.timeEnd if needed (as of React Native 0.64 these are not implemented).
if (!console.time) {
    const consoleTimes = new Map();
    console.time = (label = "default") => {
        consoleTimes.set(label, performance.now());
    };
    console.timeEnd = (label = "default") => {
        const end = performance.now();
        const start = consoleTimes.get(label);
        if (!!start) {
            consoleTimes.delete(label);
            console.log(`${label}: ${end - start} ms`);
        }
    };
}
{
    const setPerformanceLogLevel = Object.getOwnPropertyDescriptor(Tools, "PerformanceLogLevel")?.set;
    if (!setPerformanceLogLevel) {
        console.warn(`NativeTracing was not hooked into Babylon.js performance logging because the Tools.PerformanceLogLevel property does not exist.`);
    }
    else {
        // Keep a map of trace region opaque pointers since Tools.EndPerformanceCounter just takes a counter name as an argument.
        const traceRegions = new Map();
        let currentLevel = Tools.PerformanceNoneLogLevel;
        Object.defineProperty(Tools, "PerformanceLogLevel", {
            set: (level) => {
                // No-op if the log level isn't changing, otherwise we can end up with multiple wrapper layers repeating the same work.
                if (level !== currentLevel) {
                    currentLevel = level;
                    // Invoke the original PerformanceLevel setter.
                    setPerformanceLogLevel(currentLevel);
                    if (currentLevel === Tools.PerformanceNoneLogLevel) {
                        _native.disablePerformanceLogging();
                    }
                    else {
                        _native.enablePerformanceLogging();
                        // When Tools.PerformanceLogLevel is set, it assigns the Tools.StartPerformanceCounter and Tools.EndPerformanceCounter functions, so we need to assign
                        // these functions again in order to wrap them.
                        const originalStartPerformanceCounter = Tools.StartPerformanceCounter;
                        Tools.StartPerformanceCounter = (counterName, condition = true) => {
                            // Call into native before so the time it takes is not captured in the JS perf counter interval.
                            if (condition) {
                                if (traceRegions.has(counterName)) {
                                    console.warn(`Performance counter '${counterName}' already exists.`);
                                }
                                else {
                                    traceRegions.set(counterName, _native.startPerformanceCounter(counterName));
                                }
                            }
                            originalStartPerformanceCounter(counterName, condition);
                        };
                        const originalEndPerformanceCounter = Tools.EndPerformanceCounter;
                        Tools.EndPerformanceCounter = (counterName, condition = true) => {
                            originalEndPerformanceCounter(counterName, condition);
                            // Call into native after so the time it takes is not captured in the JS perf counter interval.
                            if (condition) {
                                const traceRegion = traceRegions.get(counterName);
                                if (traceRegion) {
                                    _native.endPerformanceCounter(traceRegion);
                                    traceRegions.delete(counterName);
                                }
                                else {
                                    console.warn(`Performance counter '${counterName}' does not exist.`);
                                }
                            }
                        };
                    }
                }
            },
        });
    }
}

export function useEngine() {
    const [engine, setEngine] = useState();
    useEffect(() => {
        const abortController = new AbortController();
        let engine = undefined;
        (async () => {
            setEngine(engine = await ReactNativeEngine.tryCreateAsync(abortController.signal) ?? undefined);
        })();
        return () => {
            abortController.abort();
            // NOTE: Do not use setEngine with a callback to dispose the engine instance as that callback does not get called during component unmount when compiled in release.
            engine?.dispose();
            setEngine(undefined);
        };
    }, []);
    return engine;
}

export function withEngine(MyComponent) {
    return class EngineWrapper extends Component {
        constructor(props) {
            super(props);
            this.state = { abortController: new AbortController(), engine: undefined };
        }

        async componentDidMount() {
            let newEngine;
            if (this.state.abortController)
                newEngine = await ReactNativeEngine.tryCreateAsync({ signal: this.state.abortController.signal });
            this.setState({ engine: newEngine ?? undefined });
        }

        componentWillUnmount() {
            this.state.abortController?.abort();
            this.state.engine?.dispose();
        }

        render() {
            return (
                <MyComponent { ...this.props } engine={ this.state.engine } />
            );
        }
    };
}
//# sourceMappingURL=EngineHook.js.map
