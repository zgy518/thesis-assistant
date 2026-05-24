import { useEffect, useRef } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface VoiceInputProps {
  onText: (text: string) => void;
  className?: string;
  lang?: "zh-CN" | "en-US";
  targetRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export default function VoiceInput({ onText, className, lang = "zh-CN", targetRef }: VoiceInputProps) {
  const { isListening, transcript, interim, error, supported, start, stop } =
    useSpeechRecognition();

  // Auto-insert final transcript chunks at cursor
  const lastTranscriptLen = useRef(0);
  useEffect(() => {
    if (transcript.length > lastTranscriptLen.current) {
      const newText = transcript.slice(lastTranscriptLen.current);
      lastTranscriptLen.current = transcript.length;

      if (targetRef?.current) {
        const el = targetRef.current;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const before = el.value.slice(0, start);
        const after = el.value.slice(end);
        el.value = before + newText + after;
        const pos = start + newText.length;
        el.selectionStart = pos;
        el.selectionEnd = pos;
        el.focus();
        el.dispatchEvent(new Event("input", { bubbles: true }));
        onText(el.value);
      } else {
        onText(newText);
      }
    }
  }, [transcript]);

  if (!supported) {
    return (
      <span className="text-xs text-slate-400">
        (语音输入需要 Chrome 或 Edge 浏览器)
      </span>
    );
  }

  return (
    <div className={className}>
      {error && <p className="mb-1 text-xs text-red-500">{error}</p>}
      {/* Interim feedback */}
      {isListening && interim && (
        <p className="mb-1 text-xs italic text-blue-500">{interim}</p>
      )}
      <Button
        type="button"
        variant={isListening ? "default" : "outline"}
        size="sm"
        className={isListening ? "animate-pulse bg-red-500 hover:bg-red-600" : ""}
        onClick={() => {
          if (isListening) {
            stop();
          } else {
            start(lang);
          }
        }}
      >
        {isListening ? (
          <>
            <MicOff className="mr-1 h-4 w-4" />
            停止
          </>
        ) : (
          <>
            <Mic className="mr-1 h-4 w-4" />
            {lang === "zh-CN" ? "中文语音" : "English"}
          </>
        )}
      </Button>
      {/* Language toggle when stopped */}
      {!isListening && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 h-8 text-xs"
          onClick={() => start(lang === "zh-CN" ? "en-US" : "zh-CN")}
        >
          {lang === "zh-CN" ? "切英文" : "切中文"}
        </Button>
      )}
    </div>
  );
}
