import React, { useState } from 'react';
import { 
  X, ChevronDown, Check, Gauge, Globe, Brain, History, Monitor, Moon, Sun, Palette, Sparkles, Settings2, Hash, Type, RotateCcw, LayoutDashboard,
  Code2, MapPin, Braces, Link2
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useStore } from '../store/useStore';
import { ChatSession } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SystemInstructionGallery } from './SystemInstructionGallery';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const isGroundingSupported = (model: string) => {
  return [
    'gemini-3.1-pro-preview', 
    'gemini-3.1-flash-lite-preview',
    'gemini-3-pro-preview', 
    'gemini-3-flash-preview', 
    'gemini-2.5-pro', 
    'gemini-2.5-flash'
  ].includes(model);
};

interface SidebarRightProps {
  activeSession: ChatSession;
}

export const SidebarRight: React.FC<SidebarRightProps> = ({ activeSession }) => {
  const { 
    activeMode, configs, setConfig, isRightSidebarVisible, setRightSidebarVisible,
    theme, setTheme, isPromptRefinerEnabled, setPromptRefinerEnabled, resetConfig
  } = useStore();
  const config = configs[activeMode];
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isThinkingDropdownOpen, setIsThinkingDropdownOpen] = useState(false);
  const [stopSequenceInput, setStopSequenceInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const user = auth.currentUser;

  const updateSessionInstruction = (instruction: string) => {
    if (user && activeSession.id && activeSession.id !== 'local-new') {
      const sessionRef = doc(db, 'users', user.uid, 'sessions', activeSession.id);
      updateDoc(sessionRef, { systemInstruction: instruction }).catch(console.error);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } }
  } as const;

  return (
    <div className={cn(
      "fixed md:relative h-full border-l border-white/5 bg-[var(--app-bg)]/45 backdrop-blur-[40px] flex flex-col z-50 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden shadow-2xl",
      isRightSidebarVisible 
        ? "w-[320px] translate-x-0 opacity-100" 
        : "w-0 translate-x-full opacity-0 pointer-events-none md:border-none"
    )}>
      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      
      <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 relative z-10">
        <div className="flex items-center gap-3 text-[var(--app-text)] font-bold text-[15px] tracking-tight">
          <Settings2 size={16} className="text-indigo-400" />
          Paramètres
        </div>
        <button 
          onClick={() => setRightSidebarVisible(false)}
          className="md:hidden p-1.5 hover:bg-white/5 rounded-full transition-colors text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
        >
          <X size={18} />
        </button>
      </div>
    
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate={isRightSidebarVisible ? "visible" : "hidden"}
        className="flex-1 overflow-y-auto p-6 space-y-8 relative z-10 scrollbar-hide"
      >
        {/* Theme Segmented Control */}
        <motion.div variants={itemVariants} className="space-y-3">
          <label className="text-[10px] font-black text-[var(--app-text-muted)] uppercase tracking-[0.2em] ml-1">Thème</label>
          <div className="grid grid-cols-3 gap-1 p-1 bg-black/20 border border-white/5 rounded-2xl relative overflow-hidden">
            {[
              { id: 'dark', icon: Moon, label: 'Sombre' },
              { id: 'light', icon: Sun, label: 'Clair' },
              { id: 'oled', icon: Palette, label: 'OLED' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as any)}
                className={cn(
                  "relative z-10 py-2.5 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-1.5",
                  theme === t.id 
                    ? "text-[var(--app-text)]" 
                    : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                )}
              >
                {theme === t.id && (
                  <motion.div 
                    layoutId="activeTheme"
                    className="absolute inset-0 bg-white/10 border border-white/10 rounded-xl shadow-lg backdrop-blur-md z-0"
                    transition={{ type: 'spring', damping: 20, stiffness: 200 } as const}
                  />
                )}
                <t.icon size={13} className="relative z-10" />
                <span className="relative z-10">{t.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* AI Refiner Card */}
        <motion.div variants={itemVariants} className="group">
          <button 
            onClick={() => setPromptRefinerEnabled(!isPromptRefinerEnabled)}
            className={cn(
              "w-full px-5 py-4 rounded-2xl border transition-all duration-300 text-left relative overflow-hidden flex items-center justify-between",
              isPromptRefinerEnabled 
                ? "bg-indigo-500/15 border-indigo-500/30 shadow-lg shadow-indigo-500/5" 
                : "bg-white/[0.02] border-white/5 hover:border-white/10"
            )}
          >
            <div className="flex items-center gap-3.5 relative z-10">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                isPromptRefinerEnabled ? "bg-indigo-500 text-white shadow-lg" : "bg-white/5 text-[var(--app-text-muted)]"
              )}>
                <Sparkles size={18} fill={isPromptRefinerEnabled ? "currentColor" : "none"} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className={cn("text-[14px] font-bold tracking-tight", isPromptRefinerEnabled ? "text-indigo-400" : "text-[var(--app-text)]")}>Raffineur IA</span>
                <span className="text-[10px] text-[var(--app-text-muted)] font-medium">Optimisation auto</span>
              </div>
            </div>
            
            <div className={cn(
              "w-10 h-5 rounded-full relative transition-colors duration-500",
              isPromptRefinerEnabled ? "bg-indigo-500/40" : "bg-white/10"
            )}>
              <motion.div 
                animate={{ x: isPromptRefinerEnabled ? 22 : 2 }}
                className="w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm"
                transition={{ type: 'spring', damping: 20, stiffness: 300 } as const}
              />
            </div>
          </button>
        </motion.div>

        {/* Model Selection Card */}
        <motion.div variants={itemVariants} className="space-y-3">
          <label className="text-[10px] font-black text-[var(--app-text-muted)] uppercase tracking-[0.2em] ml-1">Modèle de langage</label>
          <div className="relative">
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className={cn(
                "w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-4 text-left flex items-center justify-between group transition-all duration-300 hover:bg-white/[0.05] hover:border-white/10",
                isModelDropdownOpen && "border-indigo-500/40 ring-4 ring-indigo-500/5 bg-white/[0.05]"
              )}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform duration-500">
                  <Brain size={20} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-bold tracking-tight text-[var(--app-text)]">
                    {({
                      'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
                      'gemini-3.1-flash-lite-preview': 'Gemini 3.1 Flash Lite',
                      'gemini-3-flash-preview': 'Gemini 3 Flash',
                      'gemini-2.5-flash-image': 'Nano Banana',
                      'veo-3.1-generate-001': 'Veo 3.1 Video',
                    } as any)[config?.model || ''] || config?.model}
                  </span>
                  <span className="text-[10px] text-[var(--app-text-muted)] opacity-70">
                    {activeMode === 'image' ? 'Générateur d\'images' : activeMode === 'video' ? 'Générateur de vidéos' : 'Fenêtre massive'}
                  </span>
                </div>
              </div>
              <ChevronDown size={14} className={cn("text-[var(--app-text-muted)] transition-transform duration-500", isModelDropdownOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isModelDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setIsModelDropdownOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                    className="absolute left-0 right-0 top-full mt-3 z-[70] bg-[var(--app-surface)]/80 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
                  >
                    <div className="p-3 space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                      {[
                        { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', info: 'Task Complexes', modes: ['chat'] },
                        { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', info: 'Économique', modes: ['chat'] },
                        { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', info: 'Vitesse pure', modes: ['chat'] },
                        { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Image', info: 'Photoréaliste', modes: ['image'] },
                        { id: 'imagen-3.0-generate-001', label: 'Imagen 3', info: 'Artistique', modes: ['image'] },
                        { id: 'veo-3.1-generate-001', label: 'Veo 3.1 Video', info: 'Ultra Real', modes: ['video'] },
                        { id: 'gemini-2.5-flash-preview-tts', label: 'Audio TTS', info: 'Naturel', modes: ['audio'] },
                      ]
                      .filter(m => m.modes.includes(activeMode))
                      .map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setConfig({ model: m.id }); setIsModelDropdownOpen(false); }}
                          className={cn(
                            "w-full text-left p-3.5 hover:bg-white/5 rounded-2xl text-[13px] transition-all flex items-center justify-between group",
                            config.model === m.id ? "bg-indigo-500/10 text-indigo-400 font-bold" : "text-[var(--app-text)] font-medium"
                          )}
                        >
                          <div className="flex flex-col">
                            <span>{m.label}</span>
                            <span className="text-[10px] text-[var(--app-text-muted)] opacity-60 font-normal">{m.info}</span>
                          </div>
                          {config.model === m.id && <Check size={14} className="text-indigo-500" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Model Specific Settings */}
        {activeMode === 'image' && (
          <motion.div variants={itemVariants} className="space-y-6 pt-2">
            <label className="text-[10px] font-black text-[var(--app-text-muted)] uppercase tracking-[0.2em] ml-1">Paramètres Image</label>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[var(--app-text-muted)] ml-1">Format (Aspect Ratio)</span>
                <div className="grid grid-cols-3 gap-2">
                  {['1:1', '4:3', '16:9', '9:16', '3:4'].map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setConfig({ aspectRatio: ratio })}
                      className={cn(
                        "py-2 rounded-xl text-[11px] font-bold border transition-all",
                        config.aspectRatio === ratio ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400" : "bg-white/5 border-white/5 text-[var(--app-text-muted)] hover:bg-white/10"
                      )}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[var(--app-text-muted)] ml-1">Génération de personnes</span>
                <select
                  value={config.personGeneration || 'allow_adult'}
                  onChange={(e) => setConfig({ personGeneration: e.target.value })}
                  className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-[12px] text-[var(--app-text)] outline-none focus:border-indigo-500/40"
                >
                  <option value="allow_all" className="bg-[#111]">Autoriser tout</option>
                  <option value="allow_adult" className="bg-[#111]">Adultes uniquement</option>
                  <option value="dont_allow" className="bg-[#111]">Interdire</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[11px] font-bold text-[var(--app-text-muted)] font-mono">Nombre d'images</span>
                  <span className="text-xs font-bold text-indigo-400">{config.numberOfImages || 1}</span>
                </div>
                <input 
                  type="range" min="1" max="4" step="1"
                  value={config.numberOfImages || 1}
                  onChange={(e) => setConfig({ numberOfImages: parseInt(e.target.value) })}
                  className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
              </div>
            </div>
          </motion.div>
        )}

        {activeMode === 'video' && (
          <motion.div variants={itemVariants} className="space-y-6 pt-2">
            <label className="text-[10px] font-black text-[var(--app-text-muted)] uppercase tracking-[0.2em] ml-1">Paramètres Vidéo</label>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[var(--app-text-muted)] ml-1">Résolution</span>
                <div className="grid grid-cols-3 gap-2">
                  {['720p', '1080p', '4k'].map(res => (
                    <button
                      key={res}
                      onClick={() => setConfig({ videoResolution: res })}
                      className={cn(
                        "py-2 rounded-xl text-[11px] font-bold border transition-all",
                        config.videoResolution === res ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400" : "bg-white/5 border-white/5 text-[var(--app-text-muted)] hover:bg-white/10"
                      )}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[var(--app-text-muted)] ml-1">Format</span>
                <div className="flex gap-2">
                  {['16:9', '9:16'].map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setConfig({ videoAspectRatio: ratio })}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[11px] font-bold border transition-all",
                        config.videoAspectRatio === ratio ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400" : "bg-white/5 border-white/5 text-[var(--app-text-muted)] hover:bg-white/10"
                      )}
                    >
                      {ratio === '16:9' ? 'Paysage' : 'Portrait'} ({ratio})
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[11px] font-bold text-[var(--app-text-muted)]">Durée</span>
                  <span className="text-xs font-bold text-indigo-400">{config.videoDurationSeconds || 6}s</span>
                </div>
                <div className="flex gap-2">
                  {[4, 6, 8].map(sec => (
                    <button
                      key={sec}
                      onClick={() => setConfig({ videoDurationSeconds: sec })}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                        config.videoDurationSeconds === sec ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-white/5 text-[var(--app-text-muted)]"
                      )}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tools Section - Premium Grid */}
        {isGroundingSupported(config.model) && (
          <motion.div variants={itemVariants} className="space-y-4">
            <label className="text-[10px] font-black text-[var(--app-text-muted)] uppercase tracking-[0.2em] ml-1">Capacités & Outils</label>
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { id: 'googleSearch', label: 'Google Search', icon: Globe, color: 'text-blue-400', activeBg: 'bg-blue-500/20 border-blue-500/30' },
                { id: 'codeExecution', label: 'Code Execution', icon: Code2, color: 'text-emerald-400', activeBg: 'bg-emerald-500/20 border-emerald-500/30' },
                { id: 'urlContext', label: 'URL Reader', icon: Link2, color: 'text-purple-400', activeBg: 'bg-purple-500/20 border-purple-500/30' },
              ].map((tool) => (
                <button 
                  key={tool.id}
                  onClick={() => setConfig({ [tool.id]: !Boolean((config as any)[tool.id]) })}
                  className={cn(
                    "p-4 rounded-2xl border flex items-center justify-between transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
                    (config as any)[tool.id] ? tool.activeBg : "bg-white/[0.02] border-white/5 hover:border-white/10"
                  )}
                >
                  <div className={cn("flex items-center gap-3.5", (config as any)[tool.id] ? tool.color : "text-[var(--app-text-muted)]")}>
                    <tool.icon size={16} />
                    <span className="text-[13px] font-bold tracking-tight">{tool.label}</span>
                  </div>
                  {(config as any)[tool.id] && (
                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shadow-[0_0_10px_currentColor]" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* System Prompt Context */}
        {(!config.model.includes('image') && !config.model.includes('veo') && !config.model.includes('tts')) && (
          <motion.div variants={itemVariants} className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-1 px-1">
              <label className="text-[10px] font-black text-[var(--app-text-muted)] uppercase tracking-[0.2em]">Instructions Système</label>
              <button
                onClick={() => setShowGallery(true)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider"
              >
                <LayoutDashboard size={12} />
                Galerie
              </button>
            </div>
            
            <div className="relative group">
              <textarea
                value={config.systemInstruction || ''}
                onChange={(e) => {
                  const newVal = e.target.value;
                  setConfig({ systemInstruction: newVal });
                  updateSessionInstruction(newVal);
                }}
                placeholder="Définissez la personnalité et les règles..."
                className="w-full bg-white/[0.02] rounded-2xl p-4 text-[13px] text-[var(--app-text)] border border-white/5 focus:border-indigo-500/40 focus:ring-4 focus:ring-indigo-500/5 resize-none h-32 transition-all outline-none leading-relaxed placeholder:text-white/10"
              />
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="p-1 px-2 rounded-md bg-white/5 text-[9px] font-mono text-white/30 backdrop-blur-sm">PROMPT_MD</div>
              </div>
            </div>

            {/* Thinking Levels - Modern Pills */}
            <div className="space-y-3">
               <label className="text-[10px] font-black text-[var(--app-text-muted)] uppercase tracking-[0.2em] ml-1">Réflexion interne</label>
               <div className="flex gap-2">
                 {[
                   { id: 'minimal', label: 'Eco' },
                   { id: 'low', label: 'Flash' },
                   { id: 'medium', label: 'Pro' },
                   { id: 'high', label: 'High' }
                 ].filter(l => !(config.model.includes('pro') && l.id === 'minimal')).map((level) => (
                   <button
                    key={level.id}
                    onClick={() => setConfig({ thinkingLevel: level.id as any })}
                    className={cn(
                      "flex-1 py-2 px-1 rounded-xl text-[11px] font-bold border transition-all duration-300",
                      config.thinkingLevel === level.id 
                        ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400 shadow-lg shadow-indigo-500/5" 
                        : "bg-white/[0.02] border-white/5 text-[var(--app-text-muted)] hover:border-white/10"
                    )}
                   >
                     {level.label}
                   </button>
                 ))}
               </div>
            </div>
          </motion.div>
        )}

        {/* Global Stats/Advanced Toggle */}
        <motion.div variants={itemVariants} className="pt-2">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full py-4 px-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between hover:bg-white/[0.04] transition-all group"
            >
              <div className="flex items-center gap-3">
                <Settings2 size={14} className={cn("transition-colors", showAdvanced ? "text-indigo-400" : "text-[var(--app-text-muted)]")} />
                <span className="text-[12px] font-bold tracking-tight">Paramètres avancés</span>
              </div>
              <ChevronDown size={14} className={cn("text-[var(--app-text-muted)] transition-transform duration-500", showAdvanced && "rotate-180")} />
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden px-1"
                >
                  <div className="py-6 space-y-7">
                    {/* Reusable Slider Component Style */}
                    {[
                      { key: 'temperature', label: 'Température', min: 0, max: 2, step: 0.1, color: 'indigo' },
                      { key: 'topP', label: 'Top P', min: 0, max: 1, step: 0.01, color: 'indigo' },
                      { key: 'topK', label: 'Top K', min: 1, max: 100, step: 1, color: 'indigo' },
                      { key: 'maxOutputTokens', label: 'Max Output', min: 1, max: 8192, step: 128, color: 'indigo' },
                    ].map((s) => (
                      <div key={s.key} className="space-y-4">
                        <div className="flex justify-between items-end">
                          <label className="text-[11px] font-bold text-[var(--app-text-muted)] tracking-wide">{s.label}</label>
                          <span className="font-mono text-[12px] text-indigo-400 font-bold">{(config as any)[s.key]}</span>
                        </div>
                        <input 
                          type="range" min={s.min} max={s.max} step={s.step}
                          value={(config as any)[s.key]}
                          onChange={(e) => setConfig({ [s.key]: parseFloat(e.target.value) })}
                          className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer hover:accent-indigo-400 transition-all"
                        />
                      </div>
                    ))}
                    
                    <button 
                      onClick={() => resetConfig()}
                      className="w-full py-3 rounded-xl border border-white/5 text-[11px] font-bold text-[var(--app-text-muted)] hover:text-red-400 hover:bg-red-400/5 hover:border-red-400/20 transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={12} />
                      Réinitialiser les paramètres
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Decorative Blur Bottom */}
      <div className="h-10 bg-gradient-to-t from-[var(--app-bg)]/80 to-transparent pointer-events-none absolute bottom-0 left-0 right-0 z-20" />

      <AnimatePresence>
        {showGallery && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 } as const}
            className="absolute inset-0 z-[80] bg-[var(--app-bg)]/95 backdrop-blur-3xl border-l border-white/10 shadow-2xl"
          >
            <SystemInstructionGallery 
              onClose={() => setShowGallery(false)}
              onSelect={(prompt) => {
                setConfig({ systemInstruction: prompt });
                updateSessionInstruction(prompt);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
