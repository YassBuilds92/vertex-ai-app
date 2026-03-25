import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Loader2, Sparkles, X, Check, MessageSquare, 
  ChevronRight, RefreshCw, LayoutDashboard, BrainCircuit, Bot, Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType, cleanForFirestore } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { CustomPrompt } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { compressImage } from '../utils/image';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SystemInstructionGalleryProps {
  onSelect: (prompt: string) => void;
  onClose: () => void;
}

export const SystemInstructionGallery: React.FC<SystemInstructionGalleryProps> = ({ onSelect, onClose }) => {
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string | null>(null);
  const [previewIcon, setPreviewIcon] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<CustomPrompt | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'users', currentUser.uid, 'custom_prompts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setPrompts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomPrompt)));
    });
  }, [currentUser]);

  const handleGenerateIcon = async () => {
    if (!newPrompt.trim()) return;
    setIsGenerating(true);
    setGenerationStep("Analyse du prompt...");
    
    try {
      // Step 1: Generate image prompt from system instruction
      const refineRes = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: newPrompt, type: 'icon' })
      });
      
      if (!refineRes.ok) throw new Error("Erreur lors de l'analyse du prompt");
      const { refinedInstruction: imagePrompt } = await refineRes.json();
      
      setGenerationStep("Génération de l'icône...");
      
      // Step 2: Generate image
      const imageRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt })
      });
      
      if (!imageRes.ok) {
          const errData = await imageRes.json();
          throw new Error(errData.details || "Erreur lors de la génération d'image");
      }
      
      const { base64 } = await imageRes.json();
      if (!base64) throw new Error("Aucune image n'a été retournée par l'IA");
      
      setPreviewIcon(base64);
    } catch (error) {
      console.error("Icon generation failed:", error);
      alert(error instanceof Error ? error.message : "Échec de la génération de l'icône");
    } finally {
      setIsGenerating(false);
      setGenerationStep(null);
    }
  };

  const backgroundGenerateIcon = async (docId: string, promptText: string) => {
    if (!currentUser) return;
    
    try {
      // Step 1: Generate image prompt
      const refineRes = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, type: 'icon' })
      });
      
      if (!refineRes.ok) throw new Error("Erreur lors de l'analyse du prompt");
      const { refinedInstruction: imagePrompt } = await refineRes.json();
      
      // Step 2: Generate image
      const imageRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt })
      });
      
      if (!imageRes.ok) throw new Error("Erreur lors de la génération d'image");
      
      const { base64 } = await imageRes.json();
      if (!base64) throw new Error("Aucune image retournée");
      
      let finalIconUrl = base64;
      if (base64.startsWith('data:image')) {
        try {
          finalIconUrl = await compressImage(base64, 256, 256, 0.7);
        } catch (compressError) {
          console.error("Compression failed:", compressError);
        }
      }

      // Step 3: Update doc
      await updateDoc(doc(db, 'users', currentUser.uid, 'custom_prompts', docId), {
        iconUrl: finalIconUrl,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Background icon generation failed:", error);
    }
  };

  const handleSave = async () => {
    if (!currentUser || !newTitle.trim() || !newPrompt.trim()) return;
    
    try {
      const path = `users/${currentUser.uid}/custom_prompts`;
      const shouldGenerateBackground = !previewIcon;
      
      let finalIconUrl = previewIcon || null;
      if (previewIcon && previewIcon.startsWith('data:image')) {
        try {
          finalIconUrl = await compressImage(previewIcon, 256, 256, 0.7);
        } catch (compressError) {
          console.error("Compression failed, saving original:", compressError);
        }
      }

      let docId = '';
      if (editingPrompt) {
        docId = editingPrompt.id;
        await updateDoc(doc(db, 'users', currentUser.uid, 'custom_prompts', docId), cleanForFirestore({
          title: newTitle.trim(),
          prompt: newPrompt.trim(),
          iconUrl: finalIconUrl,
          updatedAt: serverTimestamp()
        }));
      } else {
        const docRef = await addDoc(collection(db, path), cleanForFirestore({
          title: newTitle.trim(),
          prompt: newPrompt.trim(),
          iconUrl: finalIconUrl,
          userId: currentUser.uid,
          createdAt: serverTimestamp()
        }));
        docId = docRef.id;
      }

      if (shouldGenerateBackground) {
        backgroundGenerateIcon(docId, newPrompt.trim());
      }
      
      setIsAdding(false);
      setEditingPrompt(null);
      setNewTitle('');
      setNewPrompt('');
      setPreviewIcon(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${currentUser.uid}/custom_prompts`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'custom_prompts', id));
      setDeleteConfirmId(null);
      if (editingPrompt?.id === id) {
        setEditingPrompt(null);
        setIsAdding(false);
        setNewTitle('');
        setNewPrompt('');
        setPreviewIcon(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${currentUser.uid}/custom_prompts/${id}`);
    }
  };

  const handleEdit = (e: React.MouseEvent, prompt: CustomPrompt) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
    setEditingPrompt(prompt);
    setNewTitle(prompt.title);
    setNewPrompt(prompt.prompt);
    setPreviewIcon(prompt.iconUrl || null);
    setIsAdding(true);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--app-bg)] overflow-hidden relative">
      <div className="flex items-center justify-between p-4 border-b border-[var(--app-border)] bg-[var(--app-bg)]/80 backdrop-blur-md z-10">
        <div>
          <h2 className="text-sm font-bold text-[var(--app-text)] flex items-center gap-2">
            <LayoutDashboard size={14} className="text-indigo-400" />
            Mes Instructions
          </h2>
          <p className="text-[10px] text-[var(--app-text-muted)]">Organisez vos prompts personnalisés</p>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-[var(--app-text)]/5 rounded-lg text-[var(--app-text-muted)] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-[var(--app-border)] text-[var(--app-text-muted)] hover:border-indigo-500/40 hover:text-indigo-400 hover:bg-indigo-500/[0.02] transition-all group"
          >
            <Plus size={18} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-wider">Créer un prompt</span>
          </button>
        )}

        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-[var(--app-surface)] border border-indigo-500/30 space-y-4 shadow-xl shadow-indigo-500/5"
          >
            <div className="flex justify-between items-center">
               <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                 {editingPrompt ? "Modifier le Prompt" : "Nouveau Prompt"}
               </span>
               <button onClick={() => { setIsAdding(false); setEditingPrompt(null); }} className="text-[var(--app-text-muted)] hover:text-[var(--app-text)]"><X size={14}/></button>
            </div>
            
            <div className="space-y-3">
              <input 
                placeholder="Titre (ex: Expert React)"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full bg-[var(--app-bg)]/50 border border-[var(--app-border)] rounded-xl px-3 py-2 text-xs text-[var(--app-text)] outline-none focus:border-indigo-500/50"
              />
              <textarea 
                placeholder="Votre instruction système détaillée..."
                value={newPrompt}
                onChange={e => setNewPrompt(e.target.value)}
                className="w-full bg-[var(--app-bg)]/50 border border-[var(--app-border)] rounded-xl px-3 py-2 text-xs text-[var(--app-text)] outline-none focus:border-indigo-500/50 h-24 resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[var(--app-bg)] border border-[var(--app-border)] flex items-center justify-center overflow-hidden shrink-0 relative group">
                {previewIcon ? (
                  <img src={previewIcon} className="w-full h-full object-cover" />
                ) : (
                  <Bot size={20} className="text-[var(--app-text-muted)]" />
                )}
                {isGenerating && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 size={16} className="text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <button 
                  onClick={handleGenerateIcon}
                  disabled={isGenerating || !newPrompt.trim()}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  {isGenerating ? generationStep : (previewIcon ? "Régénérer l'icône" : "Générer une icône par IA")}
                </button>
                <p className="text-[9px] text-[var(--app-text-muted)] mt-1">
                  Une icône unique sera générée automatiquement si vous n'en choisissez pas.
                </p>
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={isGenerating || !newTitle.trim() || !newPrompt.trim()}
              className="w-full bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-600 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
            >
              {editingPrompt ? "Mettre à jour" : "Sauvegarder"}
            </button>
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-2.5 pb-6">
          <AnimatePresence mode="popLayout">
            {prompts.length === 0 && !isAdding && (
              <div className="text-center py-10 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[var(--app-text)]/[0.03] border border-[var(--app-border)] flex items-center justify-center mx-auto text-[var(--app-text-muted)]">
                  <BrainCircuit size={20} />
                </div>
                <p className="text-xs text-[var(--app-text-muted)]">Aucun prompt sauvegardé.<br/>Commencez par en créer un !</p>
              </div>
            )}
            {prompts.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group relative"
              >
                <button
                  onClick={() => {
                    onSelect(p.prompt);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-indigo-500/40 hover:bg-indigo-500/[0.02] transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--app-bg)] border border-[var(--app-border)] flex items-center justify-center overflow-hidden shrink-0 shadow-sm transition-transform group-hover:scale-105">
                    {p.iconUrl ? (
                      <img src={p.iconUrl} className="w-full h-full object-cover" />
                    ) : (
                      <MessageSquare size={16} className="text-[var(--app-text-muted)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <h3 className="text-xs font-bold text-[var(--app-text)] truncate group-hover:text-indigo-400 transition-colors">
                      {p.title}
                    </h3>
                    <p className="text-[10px] text-[var(--app-text-muted)] truncate mt-0.5">
                      {p.prompt}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1.5 absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto">
                  {deleteConfirmId === p.id ? (
                    <div className="flex items-center gap-1 bg-[var(--app-surface)] border border-red-500/30 rounded-lg p-0.5 shadow-lg pointer-events-auto">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                        className="px-2 py-1 text-[9px] font-bold text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, p.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded-md text-[9px] font-bold hover:bg-red-600 transition-colors"
                      >
                        Confirmer?
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={(e) => handleEdit(e, p)}
                        className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all shadow-sm pointer-events-auto"
                        title="Modifier"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(p.id); }}
                        className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm pointer-events-auto"
                        title="Supprimer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
