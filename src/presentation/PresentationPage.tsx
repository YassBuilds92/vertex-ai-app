import { motion } from 'motion/react';
import {
  ArrowRight,
  Bot,
  FileText,
  Globe,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';

const pillars = [
  {
    icon: Bot,
    title: 'Cowork, un agent qui agit',
    text: "Plus qu'un chat: l'agent planifie, cherche, verifie, produit des livrables et explique ce qu'il fait pendant l'execution.",
  },
  {
    icon: Globe,
    title: 'Recherche visible et sourcee',
    text: "Les recherches web, les lectures de sources et les pivots restent visibles pour garder une IA utile, transparente et honnete.",
  },
  {
    icon: FileText,
    title: 'Artefacts livrables',
    text: 'Rapports, PDF premium, documents formels et sorties telechargeables sont generes dans le meme flux de travail.',
  },
];

const highlights = [
  'Chat multimodal',
  'Image et video',
  'Audio et pieces jointes',
  'Mode Cowork autonome',
  'Timeline d’execution',
  'PDF premium et rapports',
];

const workflow = [
  {
    step: '01',
    title: 'Comprendre la demande',
    text: "L'app detecte s'il faut repondre, chercher, produire un document ou orchestrer une tache plus longue.",
  },
  {
    step: '02',
    title: 'Executer avec visibilite',
    text: "Cowork choisit ses outils, expose sa progression et garde l'utilisateur dans la boucle sans faux theatre agentique.",
  },
  {
    step: '03',
    title: 'Livrer un resultat concret',
    text: 'Texte final, analyse sourcee, PDF telechargeable ou production multimedia: la valeur sort directement de la conversation.',
  },
];

const proofPoints = [
  { label: 'Experience', value: '5 modes IA' },
  { label: 'Agentique', value: 'Recherche + outils + livrables' },
  { label: 'Infra', value: 'React, Express, Vertex AI' },
  { label: 'Positionnement', value: 'Studio IA tout-en-un' },
];

export function PresentationPage() {
  return (
    <main className="presentation-shell min-h-screen overflow-x-hidden bg-[#f2ede2] text-[#1f1a17]">
      <section className="presentation-hero relative min-h-screen">
        <div className="presentation-grid absolute inset-0 opacity-70" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,91,53,0.22),transparent_28%),radial-gradient(circle_at_15%_25%,rgba(32,87,104,0.18),transparent_30%),linear-gradient(180deg,rgba(242,237,226,0.08),rgba(242,237,226,0.84))]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col justify-between px-6 py-8 sm:px-10 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#1f1a17]/10 bg-[#1f1a17] text-[#f2ede2]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-[Georgia] text-[0.8rem] uppercase tracking-[0.3em] text-[#7a6f66]">AI Studio</p>
                <p className="text-sm text-[#524943]">Presentation produit</p>
              </div>
            </div>

            <div className="rounded-full border border-[#1f1a17]/10 bg-white/55 px-4 py-2 text-xs uppercase tracking-[0.25em] text-[#6a5f58] backdrop-blur">
              React • Express • Gemini
            </div>
          </motion.div>

          <div className="grid items-end gap-12 pb-10 pt-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(380px,0.8fr)] lg:pb-16">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.08 }}
              className="max-w-[760px]"
            >
              <p className="mb-6 font-[Georgia] text-sm uppercase tracking-[0.35em] text-[#9b4f35]">
                Une interface, plusieurs intelligences, un agent qui livre
              </p>
              <h1 className="max-w-[12ch] font-[Georgia] text-[clamp(4rem,10vw,8.8rem)] leading-[0.92] tracking-[-0.06em] text-[#1f1a17]">
                Notre app transforme la conversation en execution.
              </h1>
              <p className="mt-8 max-w-[58ch] text-[1.05rem] leading-8 text-[#4d433d] sm:text-[1.14rem]">
                AI Studio reunit chat, creation multimedia et un mode agentique nomme Cowork, capable de
                rechercher, verifier, produire des documents et rendre chaque etape lisible pour
                l'utilisateur.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                {highlights.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[#1f1a17]/10 bg-white/70 px-4 py-2 text-sm text-[#3d3430] shadow-[0_12px_30px_rgba(0,0,0,0.04)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, x: 26 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.16 }}
              className="relative overflow-hidden rounded-[2rem] border border-[#1f1a17]/10 bg-[#1f1a17] p-6 text-[#f6f1e7] shadow-[0_40px_90px_rgba(38,26,20,0.24)] sm:p-7"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,91,53,0.35),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(104,150,160,0.24),transparent_26%)]" />
              <div className="relative">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-white/50">Scenario cle</p>
                    <h2 className="mt-2 font-[Georgia] text-3xl leading-tight">Du brief au livrable</h2>
                  </div>
                  <WandSparkles className="h-6 w-6 text-[#f7a17d]" />
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45">Demande</p>
                    <p className="mt-2 text-sm leading-7 text-white/80">
                      "Documente-toi sur un sujet, synthese l'essentiel puis livre-moi un PDF propre."
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                      <Search className="h-5 w-5 text-[#f7a17d]" />
                      <p className="mt-3 text-sm font-medium">Recherche</p>
                      <p className="mt-2 text-xs leading-6 text-white/55">Sources ouvertes, verification, pivots.</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                      <Layers3 className="h-5 w-5 text-[#9cd1df]" />
                      <p className="mt-3 text-sm font-medium">Orchestration</p>
                      <p className="mt-2 text-xs leading-6 text-white/55">Timeline visible, etapes et rationale.</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                      <FileText className="h-5 w-5 text-[#f5df96]" />
                      <p className="mt-3 text-sm font-medium">Livraison</p>
                      <p className="mt-2 text-xs leading-6 text-white/55">PDF, rapport, media ou sortie telechargeable.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/78">
                  <span>Positionnement: assistant + studio + agent</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </motion.aside>
          </div>
        </div>
      </section>

      <section className="relative border-t border-black/6 px-6 py-20 sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-3">
          {pillars.map(({ icon: Icon, title, text }, index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: index * 0.06 }}
              className="rounded-[2rem] border border-black/8 bg-white/62 p-7 shadow-[0_18px_50px_rgba(38,26,20,0.05)] backdrop-blur"
            >
              <Icon className="h-8 w-8 text-[#9b4f35]" />
              <h3 className="mt-8 font-[Georgia] text-3xl leading-tight">{title}</h3>
              <p className="mt-4 text-[0.98rem] leading-8 text-[#4f4540]">{text}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-[1440px] gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.5 }}
          >
            <p className="font-[Georgia] text-sm uppercase tracking-[0.32em] text-[#9b4f35]">Pourquoi c’est fort</p>
            <h2 className="mt-5 max-w-[10ch] font-[Georgia] text-[clamp(2.8rem,6vw,5.6rem)] leading-[0.96] tracking-[-0.05em]">
              Une app qui ne s’arrete pas a la reponse.
            </h2>
            <p className="mt-6 max-w-[52ch] text-[1.04rem] leading-8 text-[#4f4540]">
              Le coeur du produit, c’est la continuité entre intention, recherche, execution et livraison.
              On passe d’un assistant passif a un espace de travail IA complet.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {proofPoints.map((item) => (
                <div key={item.label} className="border-t border-black/10 pt-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#776c65]">{item.label}</p>
                  <p className="mt-2 text-lg text-[#231d1a]">{item.value}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="space-y-4">
            {workflow.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: index * 0.07 }}
                className="presentation-flow-item rounded-[2rem] border border-black/8 bg-[#f7f2e8] p-6 sm:p-7"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-[#9b4f35]">{item.step}</p>
                    <h3 className="mt-3 font-[Georgia] text-3xl leading-tight text-[#201a17]">{item.title}</h3>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 text-[#9b4f35]" />
                </div>
                <p className="mt-5 max-w-[60ch] text-[1rem] leading-8 text-[#524842]">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 sm:px-10 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-[1440px] overflow-hidden rounded-[2.4rem] border border-black/10 bg-[#1f1a17] text-[#f6f1e7] shadow-[0_40px_100px_rgba(38,26,20,0.24)]"
        >
          <div className="grid gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-14 lg:py-14">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/45">Message final</p>
              <h2 className="mt-4 max-w-[12ch] font-[Georgia] text-[clamp(2.8rem,5vw,4.8rem)] leading-[0.96] tracking-[-0.05em]">
                Notre app donne une forme concrete a l’IA.
              </h2>
              <p className="mt-5 max-w-[60ch] text-[1rem] leading-8 text-white/72">
                Elle combine interface conversationnelle, outils creatifs et boucle autonome pour produire
                plus qu’une reponse: un resultat exploitable, visible et presentable.
              </p>
            </div>

            <div className="grid gap-3 self-end">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                <ShieldCheck className="h-5 w-5 text-[#f7a17d]" />
                <p className="mt-3 text-sm font-medium">Transparence</p>
                <p className="mt-2 text-sm leading-7 text-white/60">Recherche, execution et livrables restent lisibles.</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                <Sparkles className="h-5 w-5 text-[#9cd1df]" />
                <p className="mt-3 text-sm font-medium">Polyvalence</p>
                <p className="mt-2 text-sm leading-7 text-white/60">Du chat rapide au PDF premium dans un seul produit.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
