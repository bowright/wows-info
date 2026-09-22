import path from 'path';
import { fileURLToPath } from 'url';
import * as Data from '../scratch/data.mjs';
import { calculateOvermatch, calculateKruppPenetration } from './calculate_ballistics.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BW_SCALE = 30; // 1 BigWorld coordinate unit = 30 meters

/**
 * Resolves Top and Stock modules from ShipUpgradeInfo.
 * Tech-tree ships have DAG upgrade chains; leaf nodes represent Top modules.
 * @param {object} rawShip 
 * @returns {object} { top: {...}, stock: {...} }
 */
export function resolveShipModules(rawShip) {
  const up = rawShip.ShipUpgradeInfo || {};
  const entries = Object.entries(up)
    .filter(([k, v]) => v && typeof v === 'object' && v.ucType)
    .map(([k, v]) => ({ key: k, ...v }));

  const byType = {};
  for (const entry of entries) {
    byType[entry.ucType] = byType[entry.ucType] || [];
    byType[entry.ucType].push(entry);
  }

  function resolveLeaf(list) {
    if (!list || list.length === 0) return null;
    if (list.length === 1) return list[0];
    const prevKeys = new Set(list.map(x => x.prev).filter(Boolean));
    return list.find(x => !prevKeys.has(x.key)) || list[list.length - 1];
  }

  function resolveRoot(list) {
    if (!list || list.length === 0) return null;
    return list.find(x => !x.prev) || list[0];
  }

  function resolveComponent(dedicatedUpgrade, hullUpgrade, componentType, preferLeaf = true) {
    const dedicatedList = dedicatedUpgrade?.components?.[componentType] || [];
    const hullList = hullUpgrade?.components?.[componentType] || [];

    if (dedicatedList.length > 0 && hullList.length > 0) {
      // Find candidate from dedicated upgrade that is supported by hull
      const target = preferLeaf ? dedicatedList[dedicatedList.length - 1] : dedicatedList[0];
      if (hullList.includes(target)) {
        return target;
      }
      const match = dedicatedList.find(c => hullList.includes(c));
      if (match) return match;
      return target;
    }
    if (dedicatedList.length > 0) {
      return preferLeaf ? dedicatedList[dedicatedList.length - 1] : dedicatedList[0];
    }
    if (hullList.length > 0) {
      return preferLeaf ? hullList[hullList.length - 1] : hullList[0];
    }
    return null;
  }

  const topHullUpgrade = resolveLeaf(byType['_Hull']);
  const stockHullUpgrade = resolveRoot(byType['_Hull']);

  const topSuoUpgrade = resolveLeaf(byType['_Suo']);
  const stockSuoUpgrade = resolveRoot(byType['_Suo']);

  const topArtUpgrade = resolveLeaf(byType['_Artillery']);
  const stockArtUpgrade = resolveRoot(byType['_Artillery']);

  const topTorpUpgrade = resolveLeaf(byType['_Torpedoes']);
  const stockTorpUpgrade = resolveRoot(byType['_Torpedoes']);

  const topEngUpgrade = resolveLeaf(byType['_Engine']);
  const stockEngUpgrade = resolveRoot(byType['_Engine']);

  // Extract component keys
  const topHullKey = topHullUpgrade?.components?.hull?.[0] || 'A_Hull';
  const stockHullKey = stockHullUpgrade?.components?.hull?.[0] || 'A_Hull';

  const topArtKey = resolveComponent(topArtUpgrade, topHullUpgrade, 'artillery', true);
  const stockArtKey = resolveComponent(stockArtUpgrade, stockHullUpgrade, 'artillery', false);

  const topSuoKey = topSuoUpgrade?.components?.fireControl?.[0] || null;
  const stockSuoKey = stockSuoUpgrade?.components?.fireControl?.[0] || null;

  const topTorpKey = resolveComponent(topTorpUpgrade, topHullUpgrade, 'torpedoes', true);
  const stockTorpKey = resolveComponent(stockTorpUpgrade, stockHullUpgrade, 'torpedoes', false);

  const topEngKey = topEngUpgrade?.components?.engine?.[0] || null;
  const stockEngKey = stockEngUpgrade?.components?.engine?.[0] || null;

  return {
    top: {
      hullKey: topHullKey,
      artilleryKey: topArtKey,
      fireControlKey: topSuoKey,
      torpedoesKey: topTorpKey,
      engineKey: topEngKey
    },
    stock: {
      hullKey: stockHullKey,
      artilleryKey: stockArtKey,
      fireControlKey: stockSuoKey,
      torpedoesKey: stockTorpKey,
      engineKey: stockEngKey
    }
  };
}

/**
 * Calculates horizontal dispersion at range in km.
 */
export function calcHorizontalDispersion(artillery, rangeKm) {
  if (!artillery || !artillery.COMMON) return 0;
  const common = artillery.COMMON;
  const taperDist = artillery.taperDist || 0;
  const rangeM = rangeKm * 1000;
  const minRadius = (common.minRadius || 0) * BW_SCALE;
  const idealRadius = (common.idealRadius || 0) * BW_SCALE;
  const idealDistance = common.idealDistance ? common.idealDistance * BW_SCALE : 1;

  if (rangeM < taperDist && taperDist > 0) {
    const atTaper = minRadius + (taperDist / idealDistance) * (idealRadius - minRadius);
    return Math.round((rangeM / taperDist) * atTaper);
  }

  const disp = minRadius + (rangeM / idealDistance) * (idealRadius - minRadius);
  return Math.round(disp);
}

/**
 * Ingests all ships and parses them into catalog and details representations.
 * @returns {{ catalog: Array<object>, detailsMap: Map<number, object> }}
 */
export function parseGameParamsData() {
  const rawShips = Data.Ship || Data.default?.Ship || [];
  const rawProj = Data.Projectile || Data.default?.Projectile || [];
  const rawTrans = Data.Translation || Data.default?.Translation || {};
  const rawAbilities = Data.Ability || Data.default?.Ability || [];
  const rawAircraft = Data.Aircraft || Data.default?.Aircraft || [];

  // Build Projectile lookup map
  const projMap = new Map();
  for (const p of Object.values(rawProj)) {
    if (p && p.name) {
      projMap.set(p.name, p);
    }
  }

  // Build Ability lookup map
  const abilityMap = new Map();
  for (const a of (Array.isArray(rawAbilities) ? rawAbilities : Object.values(rawAbilities))) {
    if (a && a.name) {
      abilityMap.set(a.name, a);
    }
  }

  // Build Aircraft lookup map for ASW / AirSupport
  const aircraftMap = new Map();
  for (const a of (Array.isArray(rawAircraft) ? rawAircraft : Object.values(rawAircraft))) {
    if (a && a.name) {
      aircraftMap.set(a.name, a);
    }
  }

  // Translation helper
  function tr(key) {
    if (!key) return '';
    return rawTrans[key]?.en || key;
  }

  const catalog = [];
  const detailsMap = new Map();

  for (const ship of rawShips) {
    const shipId = ship.id;
    const modules = resolveShipModules(ship);
    const topHull = ship[modules.top.hullKey] || ship.A_Hull || ship.B_Hull || {};
    const stockHull = ship[modules.stock.hullKey] || ship.A_Hull || {};
    const topSuo = modules.top.fireControlKey ? ship[modules.top.fireControlKey] : null;
    const stockSuo = modules.stock.fireControlKey ? ship[modules.stock.fireControlKey] : null;
    const topArt = modules.top.artilleryKey ? ship[modules.top.artilleryKey] : null;
    const stockArt = modules.stock.artilleryKey ? ship[modules.stock.artilleryKey] : null;
    const topTorp = modules.top.torpedoesKey ? ship[modules.top.torpedoesKey] : null;

    // Basic Identification
    const dispName = tr(ship.NAME) || ship.name;
    const dispShortName = tr(ship.SHORTNAME) || dispName;
    const dispDesc = tr(ship.DESC) || '';
    const shipClass = ship.typeinfo?.species || 'Cruiser';
    const nation = ship.typeinfo?.nation || 'usa';
    const tier = ship.level || 1;
    const group = ship.group || 'upgradeable';
    const isPremium = ['special', 'ultimate', 'premium', 'specialUnsellable'].includes(group);
    const isSpecial = group === 'ultimate' || group === 'specialUnsellable';

    // Survivability & Maneuverability
    const health = topHull.health || 10000;
    const stockHealth = stockHull.health || health;
    const speed = topHull.maxSpeed || 30;
    const rudderTime = topHull.rudderTime ? Math.round(topHull.rudderTime * 10) / 10 : 0;
    const turningRadius = topHull.turningRadius || 0;

    // Concealment
    const concealmentSurface = topHull.visibilityFactor ? Math.round(topHull.visibilityFactor * 100) / 100 : null;
    const concealmentAir = topHull.visibilityFactorByPlane ? Math.round(topHull.visibilityFactorByPlane * 100) / 100 : null;
    const concealmentSmoke = topHull.visibilityCoefGKInSmoke ? Math.round(topHull.visibilityCoefGKInSmoke * 100) / 100 : null;

    // Artillery / Main Battery
    let artilleryData = null;
    if (topArt && topArt.COMMON) {
      const common = topArt.COMMON;
      const caliberMm = Math.round((common.barrelDiameter || 0) * 1000);
      const turrets = Object.keys(topArt).filter(k => /^HP_.*GM/i.test(k)).length;
      const numBarrels = common.numBarrels || 1;
      const totalBarrels = turrets * numBarrels;
      const reload = common.shotDelay ? Math.round(common.shotDelay * 100) / 100 : 0;
      const traverse180 = common.rotationSpeed?.[0] ? Math.round((180 / common.rotationSpeed[0]) * 10) / 10 : 0;

      const baseRangeM = topArt.maxDist || 0;
      const topRangeKm = Math.round(((baseRangeM * (topSuo?.maxDistCoef || 1)) / 1000) * 100) / 100;
      const stockRangeKm = Math.round(((baseRangeM * (stockSuo?.maxDistCoef || 1)) / 1000) * 100) / 100;

      const sigma = topArt.sigmaCount ? Math.round(topArt.sigmaCount * 100) / 100 : 2.0;
      const horizDispAtMax = calcHorizontalDispersion(topArt, topRangeKm);
      const vertRatio = common.radiusOnMax || 0.6;
      const vertDispAtMax = Math.round(horizDispAtMax * vertRatio);

      // Shells
      const ammoList = Array.isArray(common.ammoList) ? common.ammoList : [];
      let heShell = null;
      let apShell = null;
      let sapShell = null;

      for (const ammoName of ammoList) {
        const p = projMap.get(ammoName);
        if (!p) continue;
        if (p.ammoType === 'HE') {
          const dmg = p.alphaDamage || 0;
          const dpm = reload > 0 ? Math.round((60 / reload) * totalBarrels * dmg) : 0;
          heShell = {
            name: ammoName,
            damage: dmg,
            dpm,
            fireChance: p.burnProb != null ? Math.round(p.burnProb * 100) : 0,
            penetrationMm: p.alphaPiercingHE || Math.floor(caliberMm / 6),
            bulletSpeed: p.bulletSpeed || 0
          };
        } else if (p.ammoType === 'AP') {
          const dmg = p.alphaDamage || 0;
          const dpm = reload > 0 ? Math.round((60 / reload) * totalBarrels * dmg) : 0;
          apShell = {
            name: ammoName,
            damage: dmg,
            dpm,
            krupp: p.bulletKrupp || 0,
            bulletMass: p.bulletMass || 0,
            bulletSpeed: p.bulletSpeed || 0,
            muzzlePenetrationMm: calculateKruppPenetration(p.bulletKrupp, p.bulletMass, p.bulletSpeed, p.bulletDiametr),
            overmatchMm: calculateOvermatch(caliberMm),
            ricochetStart: p.bulletRicochetAt || 45,
            alwaysRicochet: p.bulletAlwaysRicochetAt || 60
          };
        } else if (p.ammoType === 'CS') {
          const dmg = p.alphaDamage || 0;
          const dpm = reload > 0 ? Math.round((60 / reload) * totalBarrels * dmg) : 0;
          sapShell = {
            name: ammoName,
            damage: dmg,
            dpm,
            penetrationMm: p.alphaPiercingCS || 0,
            bulletSpeed: p.bulletSpeed || 0,
            ricochetStart: p.bulletRicochetAt || 70,
            alwaysRicochet: p.bulletAlwaysRicochetAt || 80
          };
        }
      }

      artilleryData = {
        caliberMm,
        turrets,
        barrelsPerTurret: numBarrels,
        totalBarrels,
        reload,
        traverse180,
        rangeKm: topRangeKm,
        stockRangeKm,
        sigma,
        horizontalDispersion: horizDispAtMax,
        verticalDispersion: vertDispAtMax,
        he: heShell,
        ap: apShell,
        sap: sapShell
      };
    }

    // Torpedoes
    let torpedoData = null;
    if (topTorp && topTorp.COMMON) {
      const common = topTorp.COMMON;
      const launchers = Object.keys(topTorp).filter(k => /^HP_.*(GT|T_\d+)/i.test(k)).length;
      const barrelsPerLauncher = common.numBarrels || 1;
      const totalTubes = launchers * barrelsPerLauncher;
      const reload = common.shotDelay ? Math.round(common.shotDelay * 10) / 10 : 0;

      const ammoName = common.ammoList?.[0];
      const p = ammoName ? projMap.get(ammoName) : null;
      if (p) {
        const torpRangeKm = p.maxDist ? Math.round((p.maxDist * 0.03) * 10) / 10 : 0;
        const damage = Math.round((p.alphaDamage || 0) / 3 + (p.damage || 0));
        torpedoData = {
          launchers,
          barrelsPerLauncher,
          totalTubes,
          reload,
          rangeKm: torpRangeKm,
          speed: p.speed || 0,
          damage,
          detectabilityKm: p.visibilityFactor || 0,
          reactionTimeSeconds: p.speed && p.visibilityFactor ? Math.round((p.visibilityFactor / (p.speed * 0.0026)) * 10) / 10 : null,
          floodChance: p.uwCritical ? Math.round(p.uwCritical * 100) : 0,
          isDeepWater: Boolean(p.isDeepWater)
        };
      }
    }

    // Top Hull Upgrade components
    const topHullUpgrade = Object.values(ship.ShipUpgradeInfo || {}).find(u => u.components?.hull?.includes(modules.top.hullKey));
    const hullComp = topHullUpgrade?.components || {};

    // AA Defense Extraction
    const airDefenseKeys = hullComp.airDefense || [];
    const atbaKeys = hullComp.atba || [];
    const artKeys = hullComp.artillery || [];
    const aaSourceKeys = new Set([...airDefenseKeys, ...atbaKeys, ...artKeys, modules.top.hullKey]);

    let nearDps = 0, midDps = 0, farDps = 0;
    let maxAaRange = 0;
    let flakCount = 0;
    let flakDamage = 0;
    const auras = [];

    for (const sk of aaSourceKeys) {
      const obj = ship[sk];
      if (!obj || typeof obj !== 'object') continue;
      for (const [k, v] of Object.entries(obj)) {
        if (!v || typeof v !== 'object') continue;
        if (v.bubbleDamage > 0 || (v.innerBubbleCount != null && v.innerBubbleCount > 0)) {
          flakCount += (v.innerBubbleCount || 0) + (v.outerBubbleCount || 0);
          if (v.bubbleDamage > 0) flakDamage = Math.max(flakDamage, Math.round(v.bubbleDamage * 7));
          if (v.maxDistance) maxAaRange = Math.max(maxAaRange, v.maxDistance / 1000);
        } else if (['near', 'medium', 'far'].includes(v.type) && v.areaDamage != null) {
          const period = v.areaDamagePeriod || 0.285714;
          const dps = Math.round(v.areaDamage / period);
          if (v.type === 'near') nearDps += dps;
          else if (v.type === 'medium') midDps += dps;
          else if (v.type === 'far') farDps += dps;
          if (v.maxDistance) maxAaRange = Math.max(maxAaRange, v.maxDistance / 1000);
          auras.push({
            type: v.type,
            dps,
            rangeKm: v.maxDistance ? Math.round((v.maxDistance / 1000) * 10) / 10 : 0,
            hitChance: v.hitChance != null ? Math.round(v.hitChance * 100) / 100 : 1
          });
        }
      }
    }

    const totalAaDps = nearDps + midDps + farDps;
    const aaRangeKm = maxAaRange > 0 ? Math.round(maxAaRange * 10) / 10 : null;
    const aaData = totalAaDps > 0 || flakCount > 0 ? {
      nearDps,
      mediumDps: midDps,
      farDps,
      totalDps: totalAaDps,
      maxRange: aaRangeKm,
      flakCount,
      flakDamage,
      auras
    } : null;

    // ASW Airstrike & Depth Charge Extraction
    let aswData = null;
    const supportKey = hullComp.airSupport?.[0];
    const supportObj = supportKey ? ship[supportKey] : Object.values(ship).find(v => v && v.chargesNum != null && v.maxDist != null);
    if (supportObj && supportObj.maxDist != null) {
      const maxDistKm = Math.round((supportObj.maxDist / 1000) * 10) / 10;
      const reload = supportObj.reloadTime || 30;
      const planeName = supportObj.ammoList?.[0];
      const plane = planeName ? aircraftMap.get(planeName) : null;
      const payloadCount = (plane?.attackerSize || 1) * (plane?.attackCount || 1) * (plane?.projectilesPerAttack || 1);
      const speed = plane?.speedMoveWithBomb || 200;
      const flightTime = Math.round(((supportObj.maxDist / (speed * 2.6))) * 10) / 10;
      const bomb = plane?.bombName ? projMap.get(plane.bombName) : null;
      const bombDamage = bomb?.alphaDamage || bomb?.damage || 0;
      aswData = {
        type: 'airstrike',
        rangeKm: maxDistKm,
        reloadTime: reload,
        flightTime,
        payloadCount,
        bombDamage,
        chargesNum: supportObj.chargesNum || 2
      };
    } else if (hullComp.depthCharges?.[0] && ship[hullComp.depthCharges[0]]) {
      const dc = ship[hullComp.depthCharges[0]];
      aswData = {
        type: 'depth_charges',
        rangeKm: 0.5,
        reloadTime: dc.reloadTime || 40,
        flightTime: 0,
        payloadCount: 2,
        bombDamage: 2000,
        chargesNum: dc.maxPacks || 2
      };
    }

    // Consumables / Abilities Extraction
    const abilities = [];
    const shipAbilities = ship.ShipAbilities || {};
    for (const [slotKey, slotData] of Object.entries(shipAbilities)) {
      if (!slotData || !slotData.abils) continue;
      const slotIndex = parseInt(slotKey.replace('AbilitySlot', ''), 10) || 0;
      for (const abilEntry of slotData.abils) {
        const abilName = abilEntry[0];
        const variantName = abilEntry[1];
        const abil = abilityMap.get(abilName);
        if (!abil) continue;
        const variantObj = (variantName && abil[variantName]) ? abil[variantName] : abil;

        abilities.push({
          slot: slotKey,
          slotIndex,
          key: abilName,
          variant: variantName || '',
          type: variantObj.consumableType || variantObj.abilityType || 'Consumable',
          name: tr(variantObj.NAME) || tr(abil.NAME) || abilName,
          description: tr(variantObj.DESC) || tr(abil.DESC) || '',
          numConsumables: variantObj.numConsumables != null ? variantObj.numConsumables : 3,
          reloadTime: variantObj.reloadTime != null ? variantObj.reloadTime : 120,
          workTime: variantObj.workTime != null ? variantObj.workTime : 30,
          preparationTime: variantObj.preparationTime || 0,
          logic: variantObj.logic || null
        });
      }
    }

    // Columnar Flat Catalog Record (~993 items)
    const catalogItem = {
      id: shipId,
      name: ship.name,
      index: ship.index,
      dispName,
      dispShortName,
      tier,
      class: shipClass,
      nation,
      group,
      isPremium,
      isSpecial,
      health,
      stockHealth,
      speed,
      rudderTime,
      turningRadius,
      concealmentSurface,
      concealmentAir,
      concealmentSmoke,
      smokePenalty: concealmentSmoke ?? null,

      // Promoted scalar columns for 60fps virtualized table
      traverse180: artilleryData?.traverse180 ?? null,
      horizontalDispersion: artilleryData?.horizontalDispersion ?? null,
      verticalDispersion: artilleryData?.verticalDispersion ?? null,
      heAlpha: artilleryData?.he?.damage ?? null,
      apAlpha: artilleryData?.ap?.damage ?? null,
      sapAlpha: artilleryData?.sap?.damage ?? null,
      torpedoDetect: torpedoData?.detectabilityKm ?? null,
      aaRange: aaRangeKm,
      aaDps: totalAaDps > 0 ? totalAaDps : null,
      flakCount: flakCount > 0 ? flakCount : null,
      aswRange: aswData ? aswData.rangeKm : null,

      artillery: artilleryData ? {
        caliberMm: artilleryData.caliberMm,
        totalBarrels: artilleryData.totalBarrels,
        reload: artilleryData.reload,
        traverse180: artilleryData.traverse180,
        rangeKm: artilleryData.rangeKm,
        sigma: artilleryData.sigma,
        horizontalDispersion: artilleryData.horizontalDispersion,
        verticalDispersion: artilleryData.verticalDispersion,
        heDpm: artilleryData.he?.dpm || 0,
        apDpm: artilleryData.ap?.dpm || 0,
        sapDpm: artilleryData.sap?.dpm || 0,
        fireChance: artilleryData.he?.fireChance || 0,
        overmatchMm: artilleryData.ap?.overmatchMm || 0
      } : null,
      torpedoes: torpedoData ? {
        totalTubes: torpedoData.totalTubes,
        rangeKm: torpedoData.rangeKm,
        speed: torpedoData.speed,
        damage: torpedoData.damage,
        reload: torpedoData.reload,
        detectabilityKm: torpedoData.detectabilityKm
      } : null,
      aa: aaData ? {
        maxRange: aaData.maxRange,
        totalDps: aaData.totalDps,
        flakCount: aaData.flakCount
      } : null,
      asw: aswData ? {
        type: aswData.type,
        rangeKm: aswData.rangeKm,
        reloadTime: aswData.reloadTime
      } : null
    };
    catalog.push(catalogItem);

    // Full Details Record (details/[shipId].json)
    const detailsItem = {
      ...catalogItem,
      description: dispDesc,
      resolvedModules: modules,
      artilleryFull: artilleryData,
      torpedoesFull: torpedoData,
      aa: aaData,
      asw: aswData,
      consumables: abilities
    };
    detailsMap.set(shipId, detailsItem);
  }

  return { catalog, detailsMap };
}

// CLI test
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log('Testing parse_gameparams.mjs...');
  const { catalog, detailsMap } = parseGameParamsData();
  console.log(`[OK] Ingested ${catalog.length} ships into catalog.`);
  console.log(`[OK] Ingested ${detailsMap.size} ships into details.`);

  // Verify Iowa
  const iowa = catalog.find(s => s.name.includes('Iowa'));
  console.log('Iowa stats:', {
    name: iowa?.dispName,
    topHealth: iowa?.health,
    stockHealth: iowa?.stockHealth,
    rangeKm: iowa?.artillery?.rangeKm,
    overmatchMm: iowa?.artillery?.overmatchMm
  });
}
