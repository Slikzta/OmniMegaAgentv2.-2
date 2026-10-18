const fs = require('fs');
const path = require('path');

const pluginJavaPath = path.resolve(
  __dirname,
  '../node_modules/@capacitor-community/speech-recognition/android/src/main/java/com/getcapacitor/community/speechrecognition/SpeechRecognition.java'
);

if (fs.existsSync(pluginJavaPath)) {
  let content = fs.readFileSync(pluginJavaPath, 'utf8');
  let modified = false;

  // 1. Ensure stop() resolves the PluginCall
  if (!content.includes('stopListening();\n            call.resolve();') &&
      !content.includes('stopListening();\r\n            call.resolve();')) {
    content = content.replace(
      /public void stop\(final PluginCall call\) \{\s*try \{\s*stopListening\(\);/m,
      'public void stop(final PluginCall call) {\n        try {\n            stopListening();\n            call.resolve();'
    );
    modified = true;
  }

  // 2. Ensure onError notifies listeningState with status "stopped" and error info
  if (!content.includes('ret.put("errorCode", error);')) {
    const target = 'SpeechRecognition.this.stopListening();\n            String errorMssg = getErrorText(error);';
    const targetCRLF = 'SpeechRecognition.this.stopListening();\r\n            String errorMssg = getErrorText(error);';
    const replacement = `SpeechRecognition.this.stopListening();
            String errorMssg = getErrorText(error);

            try {
                SpeechRecognition.this.lock.lock();
                JSObject ret = new JSObject();
                ret.put("status", "stopped");
                ret.put("error", errorMssg);
                ret.put("errorCode", error);
                SpeechRecognition.this.notifyListeners(LISTENING_EVENT, ret);
            } finally {
                SpeechRecognition.this.lock.unlock();
            }`;

    if (content.includes(targetCRLF)) {
      content = content.replace(targetCRLF, replacement);
      modified = true;
    } else if (content.includes(target)) {
      content = content.replace(target, replacement);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(pluginJavaPath, content, 'utf8');
    console.log('[patch-speech-recognition] Successfully patched SpeechRecognition.java');
  } else {
    console.log('[patch-speech-recognition] SpeechRecognition.java is already up to date.');
  }
}
