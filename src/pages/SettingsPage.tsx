import { useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { AI_MODELS, CITATION_STYLES } from "@/lib/constants";
import type { CitationStyle } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, Eye, EyeOff, Info, Download, Upload, User, GraduationCap, IdCard, Building } from "lucide-react";
import { db } from "@/services/db";
import { toast } from "sonner";

export default function SettingsPage() {
  const { settings, saveApiKey, saveApiBaseUrl, saveSettings } = useSettings();

  const [studentName, setStudentName] = useState(settings.studentName ?? "");
  const [studentId, setStudentId] = useState(settings.studentId ?? "");
  const [advisor, setAdvisor] = useState(settings.advisor ?? "");
  const [department, setDepartment] = useState(settings.department ?? "");

  const handleSaveInfo = () => {
    saveSettings({ studentName: studentName.trim(), studentId: studentId.trim(), advisor: advisor.trim(), department: department.trim() });
    toast.success("论文信息已保存");
  };
  const [apiKeyInput, setApiKeyInput] = useState(settings.apiKey);
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState(settings.apiBaseUrl);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveKey = () => {
    saveApiKey(apiKeyInput.trim());
    saveApiBaseUrl(apiBaseUrlInput.trim() || "https://api.deepseek.com");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">设置</h1>

      {/* API Key */}
      <Card>
        <CardHeader>
          <CardTitle>DeepSeek API Key</CardTitle>
          <CardDescription>
            你的 API Key 仅存储在浏览器本地，不会上传到任何服务器。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  placeholder="sk-..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button onClick={handleSaveKey} disabled={!apiKeyInput.trim()}>
                {saved ? <Check className="mr-1 h-4 w-4" /> : null}
                {saved ? "已保存" : "保存"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-base-url">API 地址</Label>
            <Input
              id="api-base-url"
              placeholder="https://api.deepseek.com"
              value={apiBaseUrlInput}
              onChange={(e) => setApiBaseUrlInput(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-slate-400">
              默认使用 DeepSeek 官方 API，也可替换为其他兼容接口。
            </p>
          </div>

          {!settings.apiKey && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                请先配置 API Key 才能使用 AI 功能。前往{" "}
                <a
                  href="https://platform.deepseek.com/api_keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  DeepSeek 开放平台
                </a>{" "}
                获取 Key。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Model */}
      <Card>
        <CardHeader>
          <CardTitle>AI 模型</CardTitle>
          <CardDescription>选择 DeepSeek 模型用于论文写作。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {AI_MODELS.map((m) => (
            <Label
              key={m.id}
              className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 hover:bg-slate-50 ${
                settings.model === m.id ? "border-blue-500 bg-blue-50" : ""
              }`}
            >
              <div>
                <div className="font-medium text-slate-800">{m.name}</div>
                <div className="text-sm text-slate-500">{m.description}</div>
              </div>
              <input
                type="radio"
                name="model"
                value={m.id}
                checked={settings.model === m.id}
                onChange={() => saveSettings({ model: m.id })}
                className="h-4 w-4 accent-blue-600"
              />
            </Label>
          ))}
        </CardContent>
      </Card>

      {/* Paper Info */}
      <Card>
        <CardHeader>
          <CardTitle>论文信息</CardTitle>
          <CardDescription>填写后在导出 Word/PDF 时自动填入封面。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="studentName">姓名</Label>
              <Input id="studentName" placeholder="你的姓名" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentId">学号</Label>
              <Input id="studentId" placeholder="你的学号" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="advisor">指导教师</Label>
              <Input id="advisor" placeholder="导师姓名" value={advisor} onChange={(e) => setAdvisor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">学院</Label>
              <Input id="department" placeholder="外国语言文学学院（区域国别学院）" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSaveInfo} size="sm">保存论文信息</Button>
        </CardContent>
      </Card>

      {/* Citation Style */}
      <Card>
        <CardHeader>
          <CardTitle>引用格式</CardTitle>
          <CardDescription>选择论文参考文献的默认引用格式。</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          {CITATION_STYLES.map((style) => (
            <Button
              key={style}
              variant={settings.citationStyle === style ? "default" : "outline"}
              onClick={() => saveSettings({ citationStyle: style as CitationStyle })}
            >
              {style}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Data Backup */}
      <Card>
        <CardHeader>
          <CardTitle>数据备份</CardTitle>
          <CardDescription>
            导出全部论文数据（JSON），或从备份恢复。用于换浏览器或重装系统。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            variant="outline"
            onClick={async () => {
              const data = await db.exportAllData();
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `thesis-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              toast.success("数据已导出");
            }}
          >
            <Download className="mr-1 h-4 w-4" />
            导出全部数据
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                try {
                  const data = JSON.parse(await file.text());
                  await db.importAllData(data);
                  toast.success(`已导入 ${data.papers?.length ?? 0} 篇论文`);
                  window.location.reload();
                } catch {
                  toast.error("导入失败，请检查文件格式");
                }
              };
              input.click();
            }}
          >
            <Upload className="mr-1 h-4 w-4" />
            导入备份
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
