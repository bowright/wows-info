import {
  CompactShipCatalogItem,
  ShipBuild,
  ModifiedShipStats,
  AppliedModifier,
  ConsumableItem
} from '../types';

/**
 * Normalizes upgrade identifier to a canonical key.
 */
function normalizeUpgradeId(id: string | null | undefined): string {
  if (!id) return '';
  return id.toLowerCase().replace(/[\s_\-]/g, '');
}

/**
 * Calculates modified ship statistics given a base ship (catalog item or detail record) and a build.
 * Applies Modernizations (Slots 1-6), Commander Skills, and Combat Signals.
 */
export function calcModifiedStats(
  ship: CompactShipCatalogItem | any,
  build: ShipBuild = {}
): ModifiedShipStats {
  const modifiersApplied: AppliedModifier[] = [];

  // Clone top-level scalar primitives
  let health = ship.health || 0;
  let speed = ship.speed || 0;
  let rudderTime = ship.rudderTime || 0;
  let concealmentSurface = ship.concealmentSurface;
  let concealmentAir = ship.concealmentAir;
  let concealmentSmoke = ship.concealmentSmoke;
  let traverse180 = ship.traverse180 ?? ship.artillery?.traverse180 ?? null;
  let horizontalDispersion = ship.horizontalDispersion ?? ship.artillery?.horizontalDispersion ?? null;
  let verticalDispersion = ship.verticalDispersion ?? ship.artillery?.verticalDispersion ?? null;
  let heAlpha = ship.heAlpha ?? ship.artillery?.heAlpha ?? ship.artillery?.he?.damage ?? null;
  let apAlpha = ship.apAlpha ?? ship.artillery?.apAlpha ?? ship.artillery?.ap?.damage ?? null;
  let sapAlpha = ship.sapAlpha ?? ship.artillery?.sapAlpha ?? ship.artillery?.sap?.damage ?? null;
  let torpedoDetect = ship.torpedoDetect ?? ship.torpedoes?.detectabilityKm ?? null;
  let aaRange = ship.aaRange ?? ship.aa?.maxRange ?? null;
  let aaDps = ship.aaDps ?? ship.aa?.totalDps ?? null;
  let flakCount = ship.flakCount ?? ship.aa?.flakCount ?? null;
  let aswRange = ship.aswRange ?? ship.asw?.rangeKm ?? null;

  // Base timers
  let burnTime = ship.fireDuration ?? 60;
  let floodTime = ship.floodingDuration ?? 40;

  // Artillery clones
  let artReload = ship.artillery?.reload ?? 0;
  let artRange = ship.artillery?.rangeKm ?? 0;
  const caliberMm = ship.artillery?.caliberMm ?? 0;
  const totalBarrels = ship.artillery?.totalBarrels ?? 0;
  let fireChance = ship.artillery?.fireChance ?? 0;

  // Torpedo clones
  let torpReload = ship.torpedoes?.reload ?? 0;
  let torpRange = ship.torpedoes?.rangeKm ?? 0;
  let torpSpeed = ship.torpedoes?.speed ?? 0;
  let torpDamage = ship.torpedoes?.damage ?? 0;

  // Modifiers accumulators
  let speedMult = 1.0;
  let rudderMult = 1.0;
  let concealSurfMult = 1.0;
  let concealAirMult = 1.0;
  let artReloadMult = 1.0;
  let artRangeMult = 1.0;
  let artDispMult = 1.0;
  let artTraverseMult = 1.0;
  let traverseSpeedBonus = 0; // degrees per second
  let heAlphaMult = 1.0;
  let apAlphaMult = 1.0;
  let sapAlphaMult = 1.0;
  let torpReloadMult = 1.0;
  let aaDpsMult = 1.0;
  let flakBonus = 0;
  let burnTimeMult = 1.0;
  let floodTimeMult = 1.0;
  let consumablesExtraCharges = 0;
  let consumablesDurationMult = 1.0;

  // -------------------------------------------------------------------------
  // 1. Modernizations / Upgrade Slots 1 - 6
  // -------------------------------------------------------------------------
  const up = build.upgrades || {};

  // Slot 1
  const slot1 = normalizeUpgradeId(up.slot1);
  if (slot1 === 'mam1' || slot1 === 'mainarmamentsmod1' || slot1 === 'pcm030') {
    modifiersApplied.push({
      source: 'Main Armaments Mod 1',
      category: 'upgrade',
      description: '-20% main battery & torpedo tube crit chance, +50% survivability'
    });
  } else if (slot1 === 'aam1' || slot1 === 'auxarmamentsmod1' || slot1 === 'pcm031') {
    modifiersApplied.push({
      source: 'Aux Armaments Mod 1',
      category: 'upgrade',
      description: '+100% secondary and AA mount survivability'
    });
  } else if (slot1 === 'mag1' || slot1 === 'magazinemod1' || slot1 === 'pcm032') {
    modifiersApplied.push({
      source: 'Magazine Mod 1',
      category: 'upgrade',
      description: '-100% detonation risk'
    });
  }

  // Slot 2
  const slot2 = normalizeUpgradeId(up.slot2);
  if (slot2 === 'dcm1' || slot2 === 'damagecontrolmod1' || slot2 === 'pcm023') {
    modifiersApplied.push({
      source: 'Damage Control Mod 1',
      category: 'upgrade',
      description: '-3% fire risk, -5% flooding risk'
    });
  } else if (slot2 === 'erm1' || slot2 === 'engineroommod1' || slot2 === 'pcm021') {
    modifiersApplied.push({
      source: 'Engine Room Mod 1',
      category: 'upgrade',
      description: '-20% engine & steering gear crit chance, -20% repair time'
    });
  } else if (slot2 === 'hydro1' || slot2 === 'hydromod1' || slot2 === 'hydroacousticsearchmod1' || slot2 === 'pcm041') {
    modifiersApplied.push({
      source: 'Hydroacoustic Search Mod 1',
      category: 'upgrade',
      description: '+20% Hydroacoustic Search action time'
    });
  } else if (slot2 === 'radar1' || slot2 === 'radarmod1' || slot2 === 'surveillanceradarmod1' || slot2 === 'pcm040') {
    modifiersApplied.push({
      source: 'Surveillance Radar Mod 1',
      category: 'upgrade',
      description: '+20% Surveillance Radar action time'
    });
  } else if (slot2 === 'eb1' || slot2 === 'engineboostmod1' || slot2 === 'pcm042') {
    modifiersApplied.push({
      source: 'Engine Boost Mod 1',
      category: 'upgrade',
      description: '+40% Engine Boost action time'
    });
  }

  // Slot 3
  const slot3 = normalizeUpgradeId(up.slot3);
  if (slot3 === 'mbm2' || slot3 === 'mainbatterymod2' || slot3 === 'pcm006') {
    artTraverseMult *= 0.85; // -15% traverse time
    modifiersApplied.push({
      source: 'Main Battery Mod 2',
      category: 'upgrade',
      description: '-15% 180° gun traverse time (+15% turret traverse speed)'
    });
  } else if (slot3 === 'asm1' || slot3 === 'aimingsystemsmod1' || slot3 === 'pcm014') {
    artDispMult *= 0.93; // -7% dispersion
    modifiersApplied.push({
      source: 'Aiming Systems Mod 1',
      category: 'upgrade',
      description: '-7% main battery dispersion, +20% torpedo tube traverse, +5% secondary range/dispersion'
    });
  } else if (slot3 === 'ttm1' || slot3 === 'torpedotubesmod1' || slot3 === 'pcm017') {
    modifiersApplied.push({
      source: 'Torpedo Tubes Mod 1',
      category: 'upgrade',
      description: '+20% torpedo tube traverse speed, -40% torpedo tube crit chance'
    });
  } else if (slot3 === 'aag1' || slot3 === 'aagunsmod1' || slot3 === 'pcm010') {
    aaDpsMult *= 1.15;
    modifiersApplied.push({
      source: 'AA Guns Mod 1',
      category: 'upgrade',
      description: '+15% continuous AA DPS'
    });
  }

  // Slot 4
  const slot4 = normalizeUpgradeId(up.slot4);
  if (slot4 === 'dcm2' || slot4 === 'dcmod2' || slot4 === 'damagecontrolmod2' || slot4 === 'pcm026') {
    burnTimeMult *= 0.85;
    floodTimeMult *= 0.85;
    modifiersApplied.push({
      source: 'Damage Control Mod 2',
      category: 'upgrade',
      description: '-15% fire burn time, -15% flooding recovery time'
    });
  } else if (slot4 === 'sgm1' || slot4 === 'steeringgearsmod1' || slot4 === 'pcm025') {
    rudderMult *= 0.80;
    modifiersApplied.push({
      source: 'Steering Gears Mod 1',
      category: 'upgrade',
      description: '-20% rudder shift time'
    });
  } else if (slot4 === 'pm1' || slot4 === 'propulsionmod1' || slot4 === 'pcm024') {
    modifiersApplied.push({
      source: 'Propulsion Mod 1',
      category: 'upgrade',
      description: '-50% time to reach full power ahead/reverse'
    });
  }

  // Slot 5
  const slot5 = normalizeUpgradeId(up.slot5);
  if (slot5 === 'csm1' || slot5 === 'concealmentsystemmod1' || slot5 === 'pcm027') {
    concealSurfMult *= 0.90;
    concealAirMult *= 0.90;
    modifiersApplied.push({
      source: 'Concealment System Mod 1',
      category: 'upgrade',
      description: '-10% surface and air detectability, +5% enemy shell dispersion'
    });
  } else if (slot5 === 'sgm2' || slot5 === 'steeringgearsmod2' || slot5 === 'pcm035') {
    rudderMult *= 0.60;
    modifiersApplied.push({
      source: 'Steering Gears Mod 2',
      category: 'upgrade',
      description: '-40% rudder shift time'
    });
  } else if (slot5 === 'scm1' || slot5 === 'shipconsumablesmod1' || slot5 === 'pcm037') {
    consumablesDurationMult *= 1.10;
    modifiersApplied.push({
      source: 'Ship Consumables Mod 1',
      category: 'upgrade',
      description: '+10% action time of ship consumables'
    });
  }

  // Slot 6
  const slot6 = normalizeUpgradeId(up.slot6);
  if (slot6 === 'mbm3' || slot6 === 'mainbatterymod3' || slot6 === 'pcm013') {
    artReloadMult *= 0.88; // -12% reload
    artTraverseMult *= 1.13; // +13% traverse time
    modifiersApplied.push({
      source: 'Main Battery Mod 3',
      category: 'upgrade',
      description: '-12% main battery reload time, +13% 180° gun traverse time'
    });
  } else if (slot6 === 'gfcm2' || slot6 === 'gunfirecontrolmod2' || slot6 === 'pcm015') {
    artRangeMult *= 1.16; // +16% firing range
    modifiersApplied.push({
      source: 'Gun Fire Control Mod 2',
      category: 'upgrade',
      description: '+16% main battery firing range'
    });
  } else if (slot6 === 'ttm2' || slot6 === 'torpedotubesmod2' || slot6 === 'pcm019') {
    torpReloadMult *= 0.85; // -15% torpedo reload
    modifiersApplied.push({
      source: 'Torpedo Tubes Mod 2',
      category: 'upgrade',
      description: '-15% torpedo tubes reload time'
    });
  } else if (slot6 === 'auxm2' || slot6 === 'auxiliaryarmamentsmod2' || slot6 === 'pcm011') {
    aaDpsMult *= 1.20;
    flakBonus += 2;
    modifiersApplied.push({
      source: 'Auxiliary Armaments Mod 2',
      category: 'upgrade',
      description: '+20% continuous AA DPS, +2 flak bursts, -20% secondary battery reload'
    });
  }

  // -------------------------------------------------------------------------
  // 2. Commander Skills
  // -------------------------------------------------------------------------
  const sk = build.skills || {};

  if (sk.concealmentExpert) {
    concealSurfMult *= 0.90;
    concealAirMult *= 0.90;
    modifiersApplied.push({
      source: 'Concealment Expert',
      category: 'skill',
      description: '-10% surface and aerial detectability'
    });
  }

  if (sk.adrenalineRush) {
    const hpLost = Math.min(100, Math.max(0, sk.hpLostPercent ?? 0));
    // -0.2% reload time per 1% HP lost
    const arReduction = (hpLost * 0.2) / 100;
    artReloadMult *= (1 - arReduction);
    torpReloadMult *= (1 - arReduction);
    aaDpsMult *= (1 + arReduction);
    modifiersApplied.push({
      source: 'Adrenaline Rush',
      category: 'skill',
      description: `-${Math.round(arReduction * 100 * 10) / 10}% reload time at ${hpLost}% HP lost (+${Math.round(arReduction * 100 * 10) / 10}% AA DPS)`
    });
  }

  if (sk.heavyAP) {
    // Cruisers get +5%, Battleships get +7.5%
    const apBonus = ship.class === 'Battleship' ? 1.075 : 1.05;
    apAlphaMult *= apBonus;
    modifiersApplied.push({
      source: 'Heavy AP',
      category: 'skill',
      description: `+${Math.round((apBonus - 1) * 1000) / 10}% AP shell damage`
    });
  }

  if (sk.heavyHE) {
    heAlphaMult *= 1.10;
    sapAlphaMult *= 1.10;
    modifiersApplied.push({
      source: 'Heavy HE / SAP',
      category: 'skill',
      description: '+10% HE and SAP shell damage'
    });
  }

  if (sk.survivabilityExpert) {
    const tier = ship.tier || 10;
    const hpPerTier = (ship.class === 'Destroyer' || ship.class === 'Cruiser') ? 450 : 350;
    health += hpPerTier * tier;
    modifiersApplied.push({
      source: 'Survivability Expert',
      category: 'skill',
      description: `+${hpPerTier * tier} HP (+${hpPerTier} HP per tier)`
    });
  }

  if (sk.greaseTheGears) {
    traverseSpeedBonus += (ship.class === 'Battleship' ? 0.6 : 0.8);
    modifiersApplied.push({
      source: 'Grease the Gears',
      category: 'skill',
      description: `+${ship.class === 'Battleship' ? 0.6 : 0.8}°/s main turret traverse speed`
    });
  }

  if (sk.swiftInSilence) {
    speedMult *= 1.08;
    modifiersApplied.push({
      source: 'Swift in Silence',
      category: 'skill',
      description: '+8% ship speed while undetected'
    });
  }

  if (sk.superintendent) {
    consumablesExtraCharges += 1;
    modifiersApplied.push({
      source: 'Superintendent',
      category: 'skill',
      description: '+1 additional charge for all ship consumables'
    });
  }

  // -------------------------------------------------------------------------
  // 3. Combat Signals
  // -------------------------------------------------------------------------
  const sig = build.signals || {};

  if (sig.sierraMike) {
    speedMult *= 1.05;
    modifiersApplied.push({
      source: 'Sierra Mike',
      category: 'signal',
      description: '+5% maximum speed'
    });
  }

  if (sig.indiaYankee) {
    burnTimeMult *= 0.80;
    modifiersApplied.push({
      source: 'India Yankee',
      category: 'signal',
      description: '-20% fire burn time'
    });
  }

  if (sig.julietYankeeBissotwo) {
    floodTimeMult *= 0.80;
    modifiersApplied.push({
      source: 'Juliet Yankee Bissotwo',
      category: 'signal',
      description: '-20% flooding recovery time'
    });
  }

  if (sig.victorLima) {
    const extraBurn = caliberMm > 160 ? 1 : 0.5;
    fireChance += extraBurn;
    modifiersApplied.push({
      source: 'Victor Lima',
      category: 'signal',
      description: `+${extraBurn}% shell fire chance, +4% torpedo flooding chance`
    });
  }

  if (sig.indiaXRay) {
    const extraBurn = caliberMm > 160 ? 1 : 0.5;
    fireChance += extraBurn;
    modifiersApplied.push({
      source: 'India X-Ray',
      category: 'signal',
      description: `+${extraBurn}% shell fire chance`
    });
  }

  if (sig.mikeYankeeSoxisix) {
    modifiersApplied.push({
      source: 'Mike Yankee Soxisix',
      category: 'signal',
      description: '+5% secondary battery firing range, -5% reload time, -5% dispersion'
    });
  }

  // -------------------------------------------------------------------------
  // 4. Calculate Final Modified Values
  // -------------------------------------------------------------------------
  speed = Math.round(speed * speedMult * 100) / 100;
  rudderTime = Math.round(rudderTime * rudderMult * 10) / 10;
  burnTime = Math.round(burnTime * burnTimeMult * 10) / 10;
  floodTime = Math.round(floodTime * floodTimeMult * 10) / 10;

  if (concealmentSurface != null) {
    concealmentSurface = Math.round(concealmentSurface * concealSurfMult * 100) / 100;
  }
  if (concealmentAir != null) {
    concealmentAir = Math.round(concealmentAir * concealAirMult * 100) / 100;
  }
  if (concealmentSmoke != null) {
    // Smoke firing penalty scales slightly with range/concealment in WoWs or stays fixed
    concealmentSmoke = Math.round(concealmentSmoke * 100) / 100;
  }

  // 180° Traverse calculation with both multiplier and degrees/sec addition
  if (traverse180 != null && traverse180 > 0) {
    let baseSpeedDegPerSec = 180 / traverse180;
    baseSpeedDegPerSec += traverseSpeedBonus;
    traverse180 = (180 / baseSpeedDegPerSec) * artTraverseMult;
    traverse180 = Math.round(traverse180 * 10) / 10;
  }

  if (horizontalDispersion != null) {
    horizontalDispersion = Math.round(horizontalDispersion * artDispMult);
  }
  if (verticalDispersion != null) {
    verticalDispersion = Math.round(verticalDispersion * artDispMult);
  }

  if (heAlpha != null && heAlpha > 0) {
    heAlpha = Math.round(heAlpha * heAlphaMult);
  }
  if (apAlpha != null && apAlpha > 0) {
    apAlpha = Math.round(apAlpha * apAlphaMult);
  }
  if (sapAlpha != null && sapAlpha > 0) {
    sapAlpha = Math.round(sapAlpha * sapAlphaMult);
  }

  if (artReload > 0) {
    artReload = Math.round(artReload * artReloadMult * 100) / 100;
  }
  if (artRange > 0) {
    artRange = Math.round(artRange * artRangeMult * 100) / 100;
  }

  if (torpReload > 0) {
    torpReload = Math.round(torpReload * torpReloadMult * 10) / 10;
  }

  if (aaDps != null && aaDps > 0) {
    aaDps = Math.round(aaDps * aaDpsMult);
  }
  if (flakCount != null && flakCount > 0) {
    flakCount += flakBonus;
  }

  // Recompute DPM
  const heDpm = (artReload > 0 && heAlpha) ? Math.round((60 / artReload) * totalBarrels * heAlpha) : 0;
  const apDpm = (artReload > 0 && apAlpha) ? Math.round((60 / artReload) * totalBarrels * apAlpha) : 0;
  const sapDpm = (artReload > 0 && sapAlpha) ? Math.round((60 / artReload) * totalBarrels * sapAlpha) : 0;

  // Build modified artillery sub-object
  const modifiedArtillery = ship.artillery ? {
    ...ship.artillery,
    reload: artReload,
    rangeKm: artRange,
    traverse180: traverse180 ?? ship.artillery.traverse180,
    horizontalDispersion: horizontalDispersion ?? ship.artillery.horizontalDispersion,
    verticalDispersion: verticalDispersion ?? ship.artillery.verticalDispersion,
    heAlpha,
    apAlpha,
    sapAlpha,
    heDpm,
    apDpm,
    sapDpm,
    fireChance
  } : null;

  // Build modified torpedoes sub-object
  const modifiedTorpedoes = ship.torpedoes ? {
    ...ship.torpedoes,
    reload: torpReload,
    speed: torpSpeed,
    rangeKm: torpRange,
    damage: torpDamage,
    detectabilityKm: torpedoDetect ?? ship.torpedoes.detectabilityKm
  } : null;

  // Build modified AA sub-object
  const modifiedAa = (ship.aa || aaDps) ? {
    ...(ship.aa || {}),
    totalDps: aaDps ?? (ship.aa?.totalDps || 0),
    maxRange: aaRange ?? (ship.aa?.maxRange || 0),
    flakCount: flakCount ?? (ship.aa?.flakCount || 0)
  } : null;

  // Build modified Consumables if present on ship
  const modifiedConsumables = Array.isArray(ship.consumables)
    ? ship.consumables.map((c: ConsumableItem) => {
        let charges = c.numConsumables;
        if (charges > 0 && consumablesExtraCharges > 0) {
          charges += consumablesExtraCharges;
        }
        let duration = c.workTime;
        if (duration > 0 && consumablesDurationMult !== 1.0) {
          duration = Math.round(duration * consumablesDurationMult);
        }
        return {
          ...c,
          numConsumables: charges,
          workTime: duration
        };
      })
    : undefined;

  return {
    ...ship,
    health,
    speed,
    rudderTime,
    concealmentSurface,
    concealmentAir,
    concealmentSmoke,
    smokePenalty: concealmentSmoke,
    traverse180,
    horizontalDispersion,
    verticalDispersion,
    heAlpha,
    apAlpha,
    sapAlpha,
    torpedoDetect,
    aaRange,
    aaDps,
    flakCount,
    aswRange,
    repairPct: ship.repairPct ?? null,
    citadelRepairPct: ship.citadelRepairPct ?? null,
    fireResistance: ship.fireResistance ?? null,
    fireDuration: burnTime,
    fireDamage: ship.fireDamage ?? null,
    noOfFires: ship.noOfFires ?? null,
    torpedoProtection: ship.torpedoProtection ?? null,
    floodingDuration: floodTime,
    floodingDamage: ship.floodingDamage ?? null,
    noOfFloodings: ship.noOfFloodings ?? null,
    artillery: modifiedArtillery,
    torpedoes: modifiedTorpedoes,
    aa: modifiedAa,
    consumables: modifiedConsumables,
    modifiersApplied,
    burnTime,
    floodTime
  };
}
