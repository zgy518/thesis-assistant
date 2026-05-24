import { useState, useRef, useCallback, useEffect } from "react";

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  interim: string;
  error: string;
  supported: boolean;
  start: (lang?: "zh-CN" | "en-US") => void;
  stop: () => void;
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [supported] = useState(() => {
    return !!(window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition);
  });

  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const start = useCallback((lang: "zh-CN" | "en-US" = "zh-CN") => {
    setError("");
    setTranscript("");
    setInterim("");

    const SR = window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("当前浏览器不支持语音识别，请使用 Chrome 或 Edge。");
      return;
    }

    const recognition = new SR();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;
    // Longer results for better accuracy
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      let temp = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          temp += result[0].transcript;
        }
      }
      setTranscript((prev) => prev + final);
      setInterim(temp);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        // Don't show error for no-speech, just keep listening
        return;
      }
      if (event.error === "aborted") return;
      setError(`语音识别出错: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, transcript, interim, error, supported, start, stop };
}
