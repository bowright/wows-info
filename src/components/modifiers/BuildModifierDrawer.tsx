import React from 'react';
import {
  X,
  RotateCcw,
  Sliders,
  Shield,
  Zap,
  Flame,
  Award,
  Radio,
  Crosshair,
  SlidersHorizontal,
} from 'lucide-react';
import { useShipStore } from '../../stores/useShipStore';

interface BuildModifierDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const UPGRADE_SLOTS = [
  {
    slot: 'slot1' as const,
    label: 'Slot 1 Modernization',
    options: [
      { id: 'mam1', name: 'Main Armaments Mod 1', desc: '-20% crit risk, +50% mount HP' },
      { id: 'aam1', name: 'Aux Armaments Mod 1', desc: '+100% secondary & AA mount HP' },
      { id: 'mag1', name: 'Magazine Mod 1', desc: '-100% detonation chance' },
    ],
  },
  {
    slot: 'slot2' as const,
    label: 'Slot 2 Modernization',
    options: [
      { id: 'dcm1', name: 'Damage Control Mod 1', desc: '-3% fire risk, -5% flooding risk' },
      { id: 'erm1', name: 'Engine Room Mod 1', desc: '-20% engine/rudder crit, -20% repair' },
      { id: 'hydro1', name: 'Hydro Search Mod 1', desc: '+20% Hydro action time' },
      { id: 'radar1', name: 'Radar Mod 1', desc: '+20% Surveillance Radar action time' },
      { id: 'eb1', name: 'Engine Boost Mod 1', desc: '+40% Engine Boost action time' },
    ],
  },
  {
    slot: 'slot3' as const,
    label: 'Slot 3 Modernization',
    options: [
      { id: 'asm1', name: 'Aiming Systems Mod 1', desc: '-7% gun dispersion, +20% torp traverse' },
      { id: 'mbm2', name: 'Main Battery Mod 2', desc: '+15% turret traverse speed' },
      { id: 'ttm1', name: 'Torpedo Tubes Mod 1', desc: '+20% torp traverse, -40% crit risk' },
      { id: 'aag1', name: 'AA Guns Mod 1', desc: '+15% continuous AA DPS' },
    ],
  },
  {
    slot: 'slot4' as const,
    label: 'Slot 4 Modernization',
    options: [
      { id: 'pm1', name: 'Propulsion Mod 1', desc: '-50% time to reach full power ahead/reverse' },
      { id: 'sgm1', name: 'Steering Gears Mod 1', desc: '-20% rudder shift time' },
      { id: 'dcm2', name: 'Damage Control Mod 2', desc: '-15% fire & flooding duration' },
    ],
  },
  {
    slot: 'slot5' as const,
    label: 'Slot 5 Modernization',
    options: [
      { id: 'csm1', name: 'Concealment System Mod 1', desc: '-10% surface & air detectability' },
      { id: 'sgm2', name: 'Steering Gears Mod 2', desc: '-40% rudder shift time' },
      { id: 'scm1', name: 'Ship Consumables Mod 1', desc: '+10% action time of consumables' },
    ],
  },
  {
    slot: 'slot6' as const,
    label: 'Slot 6 Modernization',
    options: [
      { id: 'mbm3', name: 'Main Battery Mod 3', desc: '-12% main battery reload, +13% traverse' },
      { id: 'gfcm2', name: 'Gun Fire Control Mod 2', desc: '+16% main battery firing range' },
      { id: 'ttm2', name: 'Torpedo Tubes Mod 2', desc: '-15% torpedo reload time' },
      { id: 'auxm2', name: 'Aux Armaments Mod 2', desc: '+20% AA DPS, +2 flak, -20% secondary reload' },
    ],
  },
];

const COMMANDER_SKILLS = [
  {
    id: 'concealmentExpert',
    name: 'Concealment Expert',
    desc: '-10% surface and aerial detectability range',
    icon: Shield,
  },
  {
    id: 'adrenalineRush',
    name: 'Adrenaline Rush',
    desc: '-0.2% reload time & +0.2% AA DPS per 1% HP lost',
    icon: Zap,
    hasSlider: true,
  },
  {
    id: 'heavyAP',
    name: 'Heavy AP Shells',
    desc: '+5% (Cruisers) / +7.5% (Battleships) AP shell damage',
    icon: Crosshair,
  },
  {
    id: 'heavyHE',
    name: 'Heavy HE & SAP Shells',
    desc: '+10% HE and SAP shell damage',
    icon: Flame,
  },
  {
    id: 'survivabilityExpert',
    name: 'Survivability Expert',
    desc: '+450 HP (DD/CA) / +350 HP (BB) per ship tier',
    icon: Shield,
  },
  {
    id: 'greaseTheGears',
    name: 'Grease the Gears',
    desc: '+0.8°/s (Cruisers) / +0.6°/s (Battleships) turret traverse speed',
    icon: SlidersHorizontal,
  },
  {
    id: 'swiftInSilence',
    name: 'Swift in Silence',
    desc: '+8% ship speed while undetected',
    icon: Zap,
  },
  {
    id: 'superintendent',
    name: 'Superintendent',
    desc: '+1 additional charge for all ship consumables',
    icon: Award,
  },
];

const SIGNALS = [
  {
    id: 'sierraMike',
    name: 'Sierra Mike',
    desc: '+5% maximum ship speed',
  },
  {
    id: 'indiaYankee',
    name: 'India Yankee',
    desc: '-20% fire burn duration',
  },
  {
    id: 'julietYankeeBissotwo',
    name: 'Juliet Yankee Bissotwo',
    desc: '-20% flooding recovery duration',
  },
  {
    id: 'victorLima',
    name: 'Victor Lima',
    desc: '+0.5% (<=160mm) / +1% (>160mm) fire chance, +4% flood chance',
  },
  {
    id: 'indiaXRay',
    name: 'India X-Ray',
    desc: '+0.5% (<=160mm) / +1% (>160mm) fire chance',
  },
  {
    id: 'mikeYankeeSoxisix',
    name: 'Mike Yankee Soxisix',
    desc: '+5% secondary range, -5% reload, -5% dispersion',
  },
];

export const BuildModifierDrawer: React.FC<BuildModifierDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const activeBuild = useShipStore((state) => state.activeBuild);
  const setBuild = useShipStore((state) => state.setBuild);
  const resetBuild = useShipStore((state) => state.resetBuild);

  if (!isOpen) return null;

  const currentUpgrades = activeBuild.upgrades || {};
  const currentSkills = activeBuild.skills || {};
  const currentSignals = activeBuild.signals || {};
  const hpLostPercent = currentSkills.hpLostPercent ?? 50;

  const handleUpgradeSelect = (slot: string, value: string) => {
    setBuild({
      upgrades: {
        ...currentUpgrades,
        [slot]: currentUpgrades[slot as keyof typeof currentUpgrades] === value ? null : value,
      },
    });
  };

  const handleSkillToggle = (skillId: string) => {
    setBuild({
      skills: {
        ...currentSkills,
        [skillId]: !currentSkills[skillId],
      },
    });
  };

  const handleHpSlider = (val: number) => {
    setBuild({
      skills: {
        ...currentSkills,
        hpLostPercent: val,
      },
    });
  };

  const handleSignalToggle = (signalId: string) => {
    setBuild({
      signals: {
        ...currentSignals,
        [signalId]: !currentSignals[signalId],
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col z-10 animate-slide-left">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <Sliders className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Build Modifier Engine
              </h2>
              <p className="text-xs text-slate-400">
                Live stat recalculation applied to all ships in the matrix
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={resetBuild}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded border border-slate-800 transition"
              title="Reset all build modifiers"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Modernizations / Upgrades (Slots 1 - 6) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4" />
                Modernizations (Slots 1 – 6)
              </h3>
            </div>

            <div className="space-y-3">
              {UPGRADE_SLOTS.map((slotGroup) => {
                const currentVal = currentUpgrades[slotGroup.slot];
                return (
                  <div
                    key={slotGroup.slot}
                    className="p-3 bg-slate-950/50 rounded-lg border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span>{slotGroup.label}</span>
                      {currentVal && (
                        <button
                          onClick={() => handleUpgradeSelect(slotGroup.slot, '')}
                          className="text-[10px] text-slate-500 hover:text-slate-300 uppercase"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {slotGroup.options.map((opt) => {
                        const isEquipped = currentVal === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleUpgradeSelect(slotGroup.slot, opt.id)}
                            className={`text-left p-2 rounded text-xs transition border ${
                              isEquipped
                                ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
                                : 'bg-slate-900/60 text-slate-300 border-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            <div className="font-semibold">{opt.name}</div>
                            <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                              {opt.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 2: Commander Skills */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              Commander Skills
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COMMANDER_SKILLS.map((skill) => {
                const isLearned = Boolean(currentSkills[skill.id]);
                const Icon = skill.icon;
                return (
                  <div
                    key={skill.id}
                    className={`p-3 rounded-lg border transition ${
                      isLearned
                        ? 'bg-amber-500/15 text-amber-200 border-amber-500/40 shadow-sm'
                        : 'bg-slate-950/50 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <button
                      onClick={() => handleSkillToggle(skill.id)}
                      className="w-full text-left flex items-start gap-2"
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isLearned ? 'text-amber-400' : 'text-slate-500'
                        }`}
                      />
                      <div className="flex-1">
                        <div className="text-xs font-semibold">{skill.name}</div>
                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                          {skill.desc}
                        </div>
                      </div>
                    </button>

                    {/* Adrenaline Rush HP Slider */}
                    {skill.hasSlider && isLearned && (
                      <div className="mt-2.5 pt-2 border-t border-amber-500/20 space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-slate-400">HP Lost:</span>
                          <span className="text-amber-300 font-bold">{hpLostPercent}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={hpLostPercent}
                          onChange={(e) => handleHpSlider(Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>0% (Full HP)</span>
                          <span className="text-emerald-400">
                            -{(hpLostPercent * 0.2).toFixed(1)}% Reload
                          </span>
                          <span>100%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 3: Combat Signals */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-4 h-4" />
              Combat Signals
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SIGNALS.map((sig) => {
                const isMounted = Boolean(currentSignals[sig.id]);
                return (
                  <button
                    key={sig.id}
                    onClick={() => handleSignalToggle(sig.id)}
                    className={`text-left p-2.5 rounded-lg border transition ${
                      isMounted
                        ? 'bg-amber-500/15 text-amber-200 border-amber-500/40 shadow-sm'
                        : 'bg-slate-950/50 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{sig.name}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isMounted ? 'bg-amber-400' : 'bg-slate-600'
                        }`}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight mt-1">
                      {sig.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Modifiers compound automatically (e.g. CE + CSM1 = 0.81x).
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
