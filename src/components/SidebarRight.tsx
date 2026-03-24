import React, { useState } from 'react';
import { 
  X, ChevronDown, Check, Gauge, Globe, Brain, History, Monitor, Moon, Sun, Palette 
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useStore } from '../store/useStore';
import { ChatSession } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const isGroundingSupported = (model: string) => {
  return ['gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'].includes(model);
};

interface SidebarRightProps {
  activeSession: ChatSession;
}

export const SidebarRight: React.FC<SidebarRightProps> = ({ activeSession }) => {
  const { 
    activeMode, configs, setConfig, isRightSidebarVisible, setRightSidebarVisible,
    theme, setTheme
  } = useStore();
  const config = configs[activeMode];
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [stopSequenceInput, setStopSequenceInput] = useState('');
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const user = auth.currentUser;

  const updateSessionInstruction = (instruction: string) => {
    if (user && activeSession.id && activeSession.id !== 'local-new') {
      const sessionRef = doc(db, 'users', user.uid, 'sessions', activeSession.id);
      updateDoc(sessionRef, { systemInstruction: instruction }).catch(console.error);
    }
  };

  return (
    <div className={cn(
      "fixed md:relative right-0 w-[300px] h-full border-l border-[var(--app-border)] bg-[var(--app-bg)]/40 backdrop-blur-3xl flex flex-col z-50 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] md:translate-x-0",
      isRightSidebarVisible ? "translate-x-0" : "translate-x-full md:translate-x-0"
    )}>
      <div className="h-14 border-b border-[var(--app-border)] flex items-center justify-between px-5">
        <div className="flex items-center gap-2.5 text-[var(--app-text)] font-semibold text-[14px]">
          Paramètres
        </div>
        <button 
          onClick={() => setRightSidebarVisible(false)}
          className="md:hidden p-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)] rounded-lg hover:bg-[var(--app-text)]/5 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    
      <div className="flex-1 overflow-y-auto p-5 space-y-7">
        {/* Theme Selector */}
        <div className="space-y-2.5">
          <label className="text-[10px] font-bold text-[var(--app-text-muted)] uppercase tracking-[0.15em]">Thème</label>
          <div className="flex gap-1.5 p-1 bg-[var(--app-text)]/[0.03] border border-[var(--app-border)] rounded-xl">
            {[
              { id: 'dark', icon: Moon, label: 'Dark' },
              { id: 'light', icon: Sun, label: 'Light' },
              { id: 'oled', icon: Palette, label: 'OLED' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as any)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-all",
                  theme === t.id 
                    ? "bg-[var(--app-bg)] text-[var(--app-text)] shadow-sm ring-1 ring-[var(--app-border)]" 
                    : "text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-text)]/[0.04]"
                )}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model Selection */}
        <div className="space-y-2.5 relative">
          <label className="text-[10px] font-bold text-[var(--app-text-muted)] uppercase tracking-[0.15em]">Modèle</label>
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className={cn(
              "w-full bg-[var(--app-surface)] border rounded-xl px-3.5 py-2.5 text-[13px] text-[var(--app-text)] flex items-center justify-between gap-2 transition-all duration-200 cursor-pointer",
              isModelDropdownOpen 
                ? "border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-lg shadow-indigo-500/5" 
                : "border-[var(--app-border)] hover:border-[var(--app-text)]/[0.15] hover:bg-[var(--app-text)]/[0.02]"
            )}
          >
            <span className="truncate font-medium">
              {({
                'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
                'gemini-3.1-flash-lite-preview': 'Gemini 3.1 Flash Lite',
                'gemini-3-flash-preview': 'Gemini 3 Flash',
                'gemini-3.1-flash-image-preview': 'Nano Banana 2',
                'gemini-3-pro-image-preview': 'Nano Banana Pro',
                'gemini-2.5-flash-image': 'Nano Banana',
                'veo-3.1-generate-001': 'Veo 3.1 Generate',
                'veo-3.1-fast-generate-001': 'Veo 3.1 Fast',
                'gemini-2.5-flash-preview-tts': 'Gemini 2.5 TTS',
              } as Record<string, string>)[config?.model || ''] || config?.model || 'Sélectionner'}
            </span>
            <ChevronDown size={14} className={cn("text-zinc-500 transition-transform duration-300 shrink-0", isModelDropdownOpen && "rotate-180")} />
          </button>

          <AnimatePresence>
            {isModelDropdownOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setIsModelDropdownOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  className="absolute left-0 right-0 top-full mt-2 z-[70] bg-[var(--app-surface)]/95 backdrop-blur-2xl border border-[var(--app-border)] rounded-2xl shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto"
                >
                  <div className="p-2 space-y-1">
                    {[
                      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', info: '1M tokens', modes: ['chat'] },
                      { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', info: '1M tokens', modes: ['chat'] },
                      { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', info: '1M tokens', modes: ['chat'] },
                      { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2', modes: ['image'] },
                      { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro', modes: ['image'] },
                      { id: 'veo-3.1-generate-001', label: 'Veo 3.1 Generate', modes: ['video'] },
                      { id: 'veo-3.1-fast-generate-001', label: 'Veo 3.1 Fast', modes: ['video'] },
                      { id: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 TTS', modes: ['audio'] },
                    ]
                    .filter(m => m.modes.includes(activeMode))
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setConfig({ model: m.id }); setIsModelDropdownOpen(false); }}
                        className={cn(
                          "w-full text-left p-2.5 hover:bg-[var(--app-text)]/5 rounded-xl text-sm transition-colors flex items-center justify-between group",
                          config.model === m.id ? "bg-[var(--app-text)]/5 text-indigo-500 font-medium" : "text-[var(--app-text)]"
                        )}
                      >
                        <span>{m.label}</span>
                        {m.info && <span className="text-[10px] text-[var(--app-text-muted)] group-hover:text-[var(--app-text)]">{m.info}</span>}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Model Info */}
        <div className="bg-[var(--app-text)]/[0.03] border border-[var(--app-border)] rounded-xl p-3.5 space-y-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--app-text-muted)] uppercase tracking-[0.12em]">
            <Gauge size={10} />
            Infos modèle
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <span className="text-[var(--app-text-muted)]">Contexte</span>
            <span className="text-[var(--app-text)] font-medium">1M tokens</span>
          </div>
        </div>

        {/* Google Search Grounding */}
        {isGroundingSupported(config.model) && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/[0.06] to-indigo-500/[0.04] border border-blue-500/[0.12] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-400">
                <Globe size={15} />
                <span className="text-[13px] font-semibold">Google Search</span>
              </div>
              <button 
                onClick={() => setConfig({googleSearch: !config.googleSearch})}
                className={cn(
                  "w-10 h-[22px] rounded-full transition-colors duration-300 relative",
                  config.googleSearch ? "bg-blue-500" : "bg-zinc-700"
                )}
              >
                <div className={cn("w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-all", config.googleSearch ? "left-[20px]" : "left-[2px]")} />
              </button>
            </div>
          </div>
        )}

        {/* System Instructions */}
        {(!config.model.includes('image') && !config.model.includes('veo') && !config.model.includes('tts')) && (
          <div className="space-y-3 pt-5 border-t border-[var(--app-border)]">
            <label className="text-[10px] font-bold text-[var(--app-text-muted)] uppercase tracking-[0.15em] flex justify-between items-center">
              <span>Instructions Système</span>
            </label>
            <textarea
              value={config.systemInstruction || ''}
              onChange={(e) => {
                const newVal = e.target.value;
                setConfig({ systemInstruction: newVal });
                updateSessionInstruction(newVal);
              }}
              placeholder="Ex: Tu es un expert en cybersécurité..."
              className="w-full bg-[var(--app-surface)] rounded-xl px-3.5 py-3 text-[13px] text-[var(--app-text)] border border-[var(--app-border)] focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 resize-none h-24 transition-all"
            />

            {/* Thinking Level */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-bold text-[var(--app-text-muted)] uppercase tracking-[0.15em]">Niveau de Réflexion</label>
              <div className="flex gap-1.5">
                {(['low', 'medium', 'high'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setConfig({ thinkingLevel: level })}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all duration-150",
                      config.thinkingLevel === level
                        ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-500"
                        : "bg-[var(--app-text)]/[0.03] border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:border-[var(--app-text)]/[0.2]"
                    )}
                  >
                    {level === 'low' ? 'Rapide' : level === 'medium' ? 'Moyen' : 'Approfondi'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
