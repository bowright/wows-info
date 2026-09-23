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

function getTrajectoryAtRange(projectile, rangeKm) {
  if (!projectile?.TRAJECTORY) return null;
  const traj = projectile.TRAJECTORY;
  const interp = (arr, x) => {
    if (!arr || arr.length === 0) return null;
    const i = Math.floor(x);
    if (i >= arr.length - 1) return arr[arr.length - 1];
    if (i < 0) return arr[0];
    const v0 = arr[i] != null ? arr[i] : arr[i + 1];
    const v1 = arr[i + 1] != null ? arr[i + 1] : v0;
    if (v0 == null) return null;
    return v0 + (v1 - v0) * (x - i);
  };
  const ftime = interp(traj.flightTime, rangeKm);
  const imspd = interp(traj.impactVelocity, rangeKm);
  const angle = interp(traj.impactAngle, rangeKm);
  return {
    flightTime: ftime != null ? Math.round(ftime * 10) / 10 : null,
    impactVelocity: imspd != null ? Math.round(imspd) : null,
    impactAngle: angle != null ? Math.round(angle * 10) / 10 : null
  };
}

function calcShipAcceleration(hull, engine) {
  if (!hull || !hull.enginePower || !hull.tonnage || !hull.maxSpeed) return null;
  const maxSpeed = hull.maxSpeed * (1 + (engine?.speedCoef || 0));
  const pwt = Math.pow(hull.enginePower / hull.tonnage, 0.4);
  const upTime = (engine?.forwardEngineUpTime || 40) / 2.75;
  const dt = 0.25;
  const i = (pwt / upTime) * dt;
  const forsageSpeed = engine?.forwardEngineForsagMaxSpeed || 0;
  const forsage = engine?.forwardEngineForsag || 1;
  let s = 0, c = 0, l = 0, u = pwt;
  for (let step = 0; step < 10000; step++) {
    const drag = -Math.pow(l, 2) / Math.pow(maxSpeed, 2) * pwt;
    const thrust = l < forsageSpeed ? pwt * forsage + drag : c + drag;
    l += thrust * dt;
    if (l > maxSpeed * 0.9) return Math.round((s + dt / 2) * 10) / 10;
    s += dt;
    c = Math.min(c + i, u);
  }
  return Math.round(s * 10) / 10;
}

function parseArtilleryData(artillery, fireControl, projMap) {
  if (!artillery?.COMMON) return null;

  const common = artillery.COMMON;
  const caliberMm = Math.round((common.barrelDiameter || 0) * 1000);
  const turrets = Object.keys(artillery).filter((key) => /^HP_.*GM/i.test(key)).length;
  const numBarrels = common.numBarrels || 1;
  const totalBarrels = turrets * numBarrels;
  const reload = common.shotDelay ? Math.round(common.shotDelay * 100) / 100 : 0;
  const traverse180 = common.rotationSpeed?.[0]
    ? Math.round((180 / common.rotationSpeed[0]) * 10) / 10
    : 0;
  const rangeKm = Math.round(((artillery.maxDist || 0) * (fireControl?.maxDistCoef || 1) / 1000) * 100) / 100;
  const sigma = artillery.sigmaCount ? Math.round(artillery.sigmaCount * 100) / 100 : 2.0;
  const horizontalDispersion = calcHorizontalDispersion(artillery, rangeKm);
  const verticalDispersion = Math.round(horizontalDispersion * (common.radiusOnMax || 0.6));

  const shells = { he: null, ap: null, sap: null };
  for (const ammoName of Array.isArray(common.ammoList) ? common.ammoList : []) {
    const projectile = projMap.get(ammoName);
    if (!projectile) continue;
    const damage = projectile.alphaDamage || 0;
    const dpm = reload > 0 ? Math.round((60 / reload) * totalBarrels * damage) : 0;
    const traj = getTrajectoryAtRange(projectile, rangeKm);

    if (projectile.ammoType === 'HE') {
      const firesPerMin = reload > 0 ? Math.round(((projectile.burnProb || 0) * (60 / reload) * totalBarrels) * 10) / 10 : 0;
      shells.he = {
        name: ammoName,
        damage,
        dpm,
        bulletMass: projectile.bulletMass || 0,
        bulletSpeed: projectile.bulletSpeed || 0,
        airDrag: projectile.bulletAirDrag || 0,
        flightTime: traj?.flightTime ?? null,
        impactVelocity: traj?.impactVelocity ?? null,
        impactAngle: traj?.impactAngle ?? null,
        fireChance: projectile.burnProb != null ? Math.round(projectile.burnProb * 100) : 0,
        firesPerMin,
        penetrationMm: projectile.alphaPiercingHE || Math.floor(caliberMm / 6)
      };
    } else if (projectile.ammoType === 'AP') {
      const penAtRange = traj?.impactVelocity && projectile.bulletKrupp && projectile.bulletMass && projectile.bulletDiametr
        ? calculateKruppPenetration(projectile.bulletKrupp, projectile.bulletMass, traj.impactVelocity, projectile.bulletDiametr)
        : null;
      shells.ap = {
        name: ammoName,
        damage,
        dpm,
        krupp: projectile.bulletKrupp || 0,
        bulletMass: projectile.bulletMass || 0,
        bulletSpeed: projectile.bulletSpeed || 0,
        airDrag: projectile.bulletAirDrag || 0,
        flightTime: traj?.flightTime ?? null,
        impactVelocity: traj?.impactVelocity ?? null,
        impactAngle: traj?.impactAngle ?? null,
        penetrationMm: penAtRange ?? calculateKruppPenetration(
          projectile.bulletKrupp,
          projectile.bulletMass,
          projectile.bulletSpeed,
          projectile.bulletDiametr
        ),
        muzzlePenetrationMm: calculateKruppPenetration(
          projectile.bulletKrupp,
          projectile.bulletMass,
          projectile.bulletSpeed,
          projectile.bulletDiametr
        ),
        overmatchMm: calculateOvermatch(caliberMm),
        ricochetStart: projectile.bulletRicochetAt || 45,
        alwaysRicochet: projectile.bulletAlwaysRicochetAt || 60,
        ricochet: `${projectile.bulletRicochetAt || 45}° - ${projectile.bulletAlwaysRicochetAt || 60}°`,
        threshold: projectile.bulletDetonatorThreshold || 0,
        fuse: projectile.bulletDetonator || 0
      };
    } else if (projectile.ammoType === 'CS') {
      shells.sap = {
        name: ammoName,
        damage,
        dpm,
        bulletMass: projectile.bulletMass || 0,
        bulletSpeed: projectile.bulletSpeed || 0,
        airDrag: projectile.bulletAirDrag || 0,
        flightTime: traj?.flightTime ?? null,
        impactVelocity: traj?.impactVelocity ?? null,
        impactAngle: traj?.impactAngle ?? null,
        penetrationMm: projectile.alphaPiercingCS || 0,
        ricochetStart: projectile.bulletRicochetAt || 70,
        alwaysRicochet: projectile.bulletAlwaysRicochetAt || 80,
        ricochet: `${projectile.bulletRicochetAt || 70}° - ${projectile.bulletAlwaysRicochetAt || 80}°`
      };
    }
  }

  return {
    desc: `${turrets}x${numBarrels} ${caliberMm} mm`,
    caliberMm,
    turrets,
    barrelsPerTurret: numBarrels,
    totalBarrels,
    reload,
    traverse180,
    rangeKm,
    sigma,
    horizontalDispersion,
    verticalDispersion,
    apSalvo: shells.ap ? totalBarrels * (shells.ap.damage || 0) : null,
    heSalvo: shells.he ? totalBarrels * (shells.he.damage || 0) : null,
    sapSalvo: shells.sap ? totalBarrels * (shells.sap.damage || 0) : null,
    shellsPerMinute: reload > 0 ? Math.round((60 / reload) * totalBarrels * 10) / 10 : null,
    he: shells.he,
    ap: shells.ap,
    sap: shells.sap
  };
}

function parseTorpedoData(torpedo, projMap) {
  if (!torpedo?.COMMON) return null;

  const common = torpedo.COMMON;
  const launchers = Object.keys(torpedo).filter((key) => /^HP_.*(GT|T_\d+)/i.test(key)).length;
  const barrelsPerLauncher = common.numBarrels || 1;
  const totalTubes = launchers * barrelsPerLauncher;
  const reload = common.shotDelay ? Math.round(common.shotDelay * 10) / 10 : 0;
  const projectile = common.ammoList?.[0] ? projMap.get(common.ammoList[0]) : null;
  if (!projectile) return null;

  const rangeKm = projectile.maxDist ? Math.round(projectile.maxDist * 0.03 * 10) / 10 : 0;
  const damage = Math.round((projectile.alphaDamage || 0) / 3 + (projectile.damage || 0));
  const reactionTimeSeconds = projectile.speed && projectile.visibilityFactor
    ? Math.round((projectile.visibilityFactor / (projectile.speed * 0.0026)) * 10) / 10
    : null;
  const dpm = reload > 0 ? Math.round((60 / reload) * totalTubes * damage) : 0;
  const torpsPerMinute = reload > 0 ? Math.round((60 / reload) * totalTubes * 10) / 10 : 0;
  const caliberMm = projectile.bulletDiametr ? Math.round(projectile.bulletDiametr * 1000) : 533;

  return {
    desc: `${launchers}x${barrelsPerLauncher} ${caliberMm} mm`,
    launchers,
    barrelsPerLauncher,
    totalTubes,
    reload,
    rangeKm,
    speed: projectile.speed || 0,
    damage,
    detectabilityKm: projectile.visibilityFactor || 0,
    reactionTimeSeconds,
    floodChance: projectile.uwCritical ? Math.round(projectile.uwCritical * 100) : 0,
    isDeepWater: Boolean(projectile.isDeepWater),
    type: projectile.isDeepWater ? 'Deepwater' : projectile.isHoming ? 'Homing' : 'Normal',
    loaders: totalTubes,
    dpm,
    spread: projectile.spread != null ? Math.round(projectile.spread * 10) / 10 : 5.0,
    torpsPerMinute,
    homingRate: projectile.isHoming ? 18.0 : null
  };
}

function parseSecondaryData(ship, atbaKeys, projMap) {
  const mounts = [];
  let rangeM = 0;

  for (const key of atbaKeys) {
    const atba = ship[key];
    if (!atba || typeof atba !== 'object') continue;
    rangeM = Math.max(rangeM, atba.maxDist || 0);
    const common = atba.COMMON || {};
    const mountEntries = Object.entries(atba)
      .filter(([mountKey, value]) => /^HP_/.test(mountKey) && value && typeof value === 'object');

    for (const [mountKey, mount] of mountEntries) {
      const ammoList = Array.isArray(mount.ammoList) && mount.ammoList.length > 0
        ? mount.ammoList
        : common.ammoList;
      if (!Array.isArray(ammoList) || ammoList.length === 0) continue;

      mounts.push({
        mountKey,
        ammoList,
        caliberMm: Math.round((mount.barrelDiameter || common.barrelDiameter || 0) * 1000),
        numBarrels: mount.numBarrels || common.numBarrels || 1,
        reload: mount.shotDelay || common.shotDelay || 0
      });
    }

    // Some carrier ATBA objects keep all mount data in COMMON and expose only
    // positional HP_* entries. Use the common definition for those mounts.
    if (mountEntries.length === 0 && Array.isArray(common.ammoList) && common.ammoList.length > 0) {
      mounts.push({
        mountKey: key,
        ammoList: common.ammoList,
        caliberMm: Math.round((common.barrelDiameter || 0) * 1000),
        numBarrels: common.numBarrels || 1,
        reload: common.shotDelay || 0
      });
    }
  }

  if (mounts.length === 0) return null;

  const totals = {
    heDpm: 0,
    apDpm: 0,
    sapDpm: 0,
    fireChance: null,
    penetrationMm: null
  };
  let totalBarrels = 0;
  let caliberMm = 0;
  let reload = null;
  const shellTypes = new Set();

  for (const mount of mounts) {
    totalBarrels += mount.numBarrels;
    caliberMm = Math.max(caliberMm, mount.caliberMm);
    if (mount.reload > 0) reload = reload == null ? mount.reload : Math.min(reload, mount.reload);

    for (const ammoName of mount.ammoList) {
      const projectile = projMap.get(ammoName);
      if (!projectile) continue;
      const dpm = mount.reload > 0
        ? Math.round((60 / mount.reload) * mount.numBarrels * (projectile.alphaDamage || 0))
        : 0;
      const penetration = projectile.ammoType === 'HE'
        ? (projectile.alphaPiercingHE || Math.floor(mount.caliberMm / 6))
        : projectile.ammoType === 'CS'
          ? (projectile.alphaPiercingCS || 0)
          : projectile.alphaPiercingAP || 0;

      if (projectile.ammoType === 'HE') {
        totals.heDpm += dpm;
        if (projectile.burnProb != null && projectile.burnProb >= 0) {
          const chance = Math.round(projectile.burnProb * 100);
          totals.fireChance = totals.fireChance == null ? chance : Math.max(totals.fireChance, chance);
        }
        shellTypes.add('HE');
      } else if (projectile.ammoType === 'AP') {
        totals.apDpm += dpm;
        shellTypes.add('AP');
      } else if (projectile.ammoType === 'CS') {
        totals.sapDpm += dpm;
        shellTypes.add('SAP');
      } else {
        continue;
      }

      if (penetration > 0) {
        totals.penetrationMm = totals.penetrationMm == null
          ? penetration
          : Math.max(totals.penetrationMm, penetration);
      }
    }
  }

  const rangeKm = rangeM > 0 ? Math.round((rangeM / 1000) * 100) / 100 : null;
  const spm = reload > 0 ? Math.round((60 / reload) * totalBarrels * 10) / 10 : null;
  const fpm = totals.fireChance != null && spm != null ? Math.round((totals.fireChance / 100) * spm * 10) / 10 : null;
  const hitDpm = Math.round((totals.heDpm + totals.apDpm + totals.sapDpm) * 0.45);
  const flightTime = rangeKm ? Math.round((rangeKm / 0.8) * 10) / 10 : null;
  const hdisp = rangeM > 0 ? Math.round(rangeM * 0.012) : null;

  return {
    desc: `${totalBarrels}x ${caliberMm} mm`,
    rangeKm,
    caliberMm,
    totalBarrels,
    reload,
    heDpm: totals.heDpm,
    apDpm: totals.apDpm,
    sapDpm: totals.sapDpm,
    fireChance: totals.fireChance,
    penetrationMm: totals.penetrationMm,
    shellTypes: [...shellTypes],
    hitDpm,
    flightTime,
    horizontalDispersion: hdisp,
    sigma: 1.5,
    firesPerMin: fpm,
    shellsPerMinute: spm,
    mounts
  };
}

function summarizeAircraft(aircraft, projMap) {
  if (!aircraft) return null;
  const payload = aircraft.bombName ? projMap.get(aircraft.bombName) : null;
  return {
    name: aircraft.name,
    maxHealth: aircraft.maxHealth || 0,
    squadronSize: aircraft.numPlanesInSquadron || 0,
    attackerSize: aircraft.attackerSize || 0,
    attackCount: aircraft.attackCount || 0,
    projectilesPerAttack: aircraft.projectilesPerAttack || 0,
    hangarSize: aircraft.hangarSettings?.maxValue || 0,
    restorationTimeSeconds: aircraft.hangarSettings?.timeToRestore || 0,
    speed: aircraft.speedMoveWithBomb || 0,
    detectability: aircraft.visibilityFactor || 10,
    payload: payload ? {
      name: payload.name,
      type: payload.ammoType,
      alphaDamage: payload.alphaDamage || 0,
      fireChance: payload.burnProb >= 0 ? Math.round(payload.burnProb * 100) : null,
      penetrationMm: payload.alphaPiercingHE || payload.alphaPiercingCS || null,
      detonatorThreshold: payload.bulletDetonatorThreshold || null,
      detonatorFuse: payload.bulletDetonator || null,
      torpedoSpeed: payload.speed || null,
      armingTime: payload.armingTime || null,
      rangeKm: payload.maxDist ? Math.round((payload.maxDist * 30 / 1000) * 10) / 10 : null,
      floodChance: payload.uwCritical ? Math.round(payload.uwCritical * 100) : null
    } : null
  };
}

function parseAircraftData(ship, aircraftMap, projMap) {
  if (ship.typeinfo?.species !== 'AirCarrier') return null;

  const typeMap = {
    attackAircraft: ['_Fighter', 'fighter'],
    torpedoBombers: ['_TorpedoBomber', 'torpedoBomber'],
    diveBombers: ['_DiveBomber', 'diveBomber'],
    skipBombers: ['_SkipBomber', 'skipBomber']
  };
  const result = {};
  let found = false;

  for (const [outputKey, [ucType, componentType]] of Object.entries(typeMap)) {
    const entries = Object.entries(ship.ShipUpgradeInfo || {})
      .filter(([, value]) => value?.ucType === ucType)
      .map(([key, value]) => ({ key, ...value }));
    const entry = entries.at(-1);
    const componentKey = entry?.components?.[componentType]?.[0];
    const planeNames = componentKey && Array.isArray(ship[componentKey]?.planes)
      ? ship[componentKey].planes
      : [];
    const planes = planeNames
      .map((name) => summarizeAircraft(aircraftMap.get(name), projMap))
      .filter(Boolean);
    result[outputKey] = planes.length > 0 ? { planes } : null;
    found ||= planes.length > 0;
  }

  return found ? result : null;
}

function parseSubmarineData(ship, hull, hullComponents) {
  if (ship.typeinfo?.species !== 'Submarine') return null;

  const pingerObjects = (hullComponents.pinger || [])
    .map((key) => ship[key])
    .filter(Boolean);
  const pingRanges = pingerObjects.map((pinger) => pinger.waveDistance).filter((value) => value > 0);
  const pingReloads = pingerObjects.map((pinger) => pinger.waveReloadTime).filter((value) => value > 0);
  const pingSpeeds = pingerObjects.flatMap((pinger) => pinger.waveParams?.[0]?.waveSpeed || []).filter((value) => value > 0);
  const pingDurations = pingerObjects.flatMap((pinger) => pinger.sectorParams || [])
    .map((sector) => sector.lifetime)
    .filter((value) => value > 0);
  const battery = hull.SubmarineBattery || null;

  return {
    diveCapacity: battery?.capacity ?? null,
    diveCapacityRechargeRate: battery?.regenRate ?? null,
    submergedSpeed: hull.maxBuoyancySpeed ?? null,
    periscopeDetectabilityKm: hull.visibilityFactorsBySubmarine?.PERISCOPE ?? null,
    pingRangeKm: pingRanges.length > 0 ? Math.max(...pingRanges) / 1000 : null,
    pingReloadTime: pingReloads.length > 0 ? Math.min(...pingReloads) : null,
    pingSpeed: pingSpeeds.length > 0 ? Math.max(...pingSpeeds) : null,
    pingDurationsSeconds: [...new Set(pingDurations)]
  };
}

function toCatalogArtillery(data) {
  if (!data) return null;
  return {
    desc: data.desc,
    caliberMm: data.caliberMm,
    totalBarrels: data.totalBarrels,
    reload: data.reload,
    traverse180: data.traverse180,
    rangeKm: data.rangeKm,
    sigma: data.sigma,
    horizontalDispersion: data.horizontalDispersion,
    verticalDispersion: data.verticalDispersion,
    heDpm: data.he?.dpm || 0,
    apDpm: data.ap?.dpm || 0,
    sapDpm: data.sap?.dpm || 0,
    heAlpha: data.he?.damage ?? null,
    apAlpha: data.ap?.damage ?? null,
    sapAlpha: data.sap?.damage ?? null,
    apSalvo: data.apSalvo ?? null,
    heSalvo: data.heSalvo ?? null,
    sapSalvo: data.sapSalvo ?? null,
    shellsPerMinute: data.shellsPerMinute ?? null,
    fireChance: data.he?.fireChance || 0,
    overmatchMm: data.ap?.overmatchMm || 0,
    he: data.he,
    ap: data.ap,
    sap: data.sap
  };
}

function toCatalogTorpedoes(data) {
  if (!data) return null;
  return {
    desc: data.desc,
    type: data.type,
    loaders: data.loaders,
    dpm: data.dpm,
    totalTubes: data.totalTubes,
    rangeKm: data.rangeKm,
    speed: data.speed,
    damage: data.damage,
    spread: data.spread,
    floodChance: data.floodChance,
    reload: data.reload,
    detectabilityKm: data.detectabilityKm,
    reactionTimeSeconds: data.reactionTimeSeconds,
    torpsPerMinute: data.torpsPerMinute,
    homingRate: data.homingRate
  };
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

  const translatedNameCounts = new Map();
  for (const rawShip of rawShips) {
    const name = tr(rawShip.NAME) || rawShip.name;
    translatedNameCounts.set(name, (translatedNameCounts.get(name) || 0) + 1);
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
    const stockTorp = modules.stock.torpedoesKey ? ship[modules.stock.torpedoesKey] : null;

    // Basic Identification
    const group = ship.group || 'upgradeable';
    const baseDispName = tr(ship.NAME) || ship.name;
    const dispName = translatedNameCounts.get(baseDispName) > 1 &&
      (group === 'demoWithoutStats' || group === 'demoWithoutStatsPrem')
      ? `${baseDispName} (Test)`
      : baseDispName;
    const dispShortName = tr(ship.SHORTNAME) || dispName;
    const dispDesc = tr(ship.DESC) || '';
    const shipClass = ship.typeinfo?.species || 'Cruiser';
    const nation = ship.typeinfo?.nation || 'usa';
    const tier = ship.level || 1;
    const isPremium = ['special', 'ultimate', 'premium', 'specialUnsellable'].includes(group);
    const isSpecial = group === 'ultimate' || group === 'specialUnsellable';

    const topEngineKey = modules.top.engineKey;
    const topEngine = topEngineKey ? ship[topEngineKey] : (ship.A1_Engine || ship.A_Engine || null);

    // General ship metrics matching shiptool.st (p=GEN)
    const year = ship.YEAR ? String(ship.YEAR) : null;
    const length = topHull.size ? Math.round(topHull.size[0] * 10) / 10 : null;
    const beam = topHull.size ? Math.round(topHull.size[1] * 10) / 10 : null;
    const tonnage = topHull.tonnage || null;
    const enginePower = topHull.enginePower || null;
    const powerWeight = topHull.enginePower && topHull.tonnage
      ? Math.round((topHull.enginePower / topHull.tonnage) * 100) / 100
      : null;
    const acceleration = calcShipAcceleration(topHull, topEngine);

    // Survivability & Maneuverability
    const health = topHull.health || 10000;
    const stockHealth = stockHull.health || health;
    const speed = topHull.maxSpeed || 30;
    const stockSpeed = stockHull.maxSpeed || speed;
    const rudderTime = topHull.rudderTime ? Math.round(topHull.rudderTime * 10) / 10 : 0;
    const stockRudderTime = stockHull.rudderTime ? Math.round(stockHull.rudderTime * 10) / 10 : rudderTime;
    const turningRadius = topHull.turningRadius || 0;
    const stockTurningRadius = stockHull.turningRadius || turningRadius;

    // Survivability metrics matching shiptool.st (p=SRV)
    const repairPct = topHull.Hull?.regeneratedHPPart != null
      ? Math.round(topHull.Hull.regeneratedHPPart * 100)
      : 50;
    const citadelRepairPct = topHull.Cit?.regeneratedHPPart != null
      ? Math.round(topHull.Cit.regeneratedHPPart * 100)
      : null;
    const fireResistance = topHull.burnNodes?.[0]
      ? Math.round((1 - topHull.burnNodes[0][0]) * 1000) / 10
      : 50;
    const fireDuration = topHull.burnNodes?.[0] ? topHull.burnNodes[0][2] : 60;
    const fireDamage = topHull.burnNodes?.[0]
      ? Math.round(topHull.burnNodes[0][1] * topHull.burnNodes[0][2] * 10) / 10
      : 18;
    const noOfFires = topHull.burnNodes ? topHull.burnNodes.length : 4;
    const torpedoProtection = topHull.floodNodes?.[0]
      ? Math.max(0, Math.round((1 - 3 * topHull.floodNodes[0][0]) * 100))
      : 0;
    const floodingDuration = topHull.floodNodes?.[0] ? topHull.floodNodes[0][2] : 40;
    const floodingDamage = topHull.floodNodes?.[0]
      ? Math.round(topHull.floodNodes[0][1] * topHull.floodNodes[0][2] * 10) / 10
      : 10;
    const noOfFloodings = topHull.floodNodes ? topHull.floodNodes.length : 2;

    // Concealment
    const concealmentSurface = topHull.visibilityFactor ? Math.round(topHull.visibilityFactor * 100) / 100 : null;
    const concealmentAir = topHull.visibilityFactorByPlane ? Math.round(topHull.visibilityFactorByPlane * 100) / 100 : null;
    const rawSmokePenalty = topHull.visibilityCoefGKInSmoke;
    const concealmentSmoke = Number.isFinite(rawSmokePenalty) && rawSmokePenalty > 0.001
      ? Math.round(rawSmokePenalty * 100) / 100
      : null;
    const stockConcealmentSurface = stockHull.visibilityFactor ? Math.round(stockHull.visibilityFactor * 100) / 100 : concealmentSurface;
    const stockConcealmentAir = stockHull.visibilityFactorByPlane ? Math.round(stockHull.visibilityFactorByPlane * 100) / 100 : concealmentAir;
    const stockRawSmokePenalty = stockHull.visibilityCoefGKInSmoke;
    const stockConcealmentSmoke = Number.isFinite(stockRawSmokePenalty) && stockRawSmokePenalty > 0.001
      ? Math.round(stockRawSmokePenalty * 100) / 100
      : null;

    // Artillery / Main Battery
    const artilleryData = parseArtilleryData(topArt, topSuo, projMap);
    const stockArtilleryData = parseArtilleryData(stockArt, stockSuo, projMap);

    // Torpedoes
    const torpedoData = parseTorpedoData(topTorp, projMap);
    const stockTorpedoData = parseTorpedoData(stockTorp, projMap);

    // Top Hull Upgrade components
    const topHullUpgrade = Object.values(ship.ShipUpgradeInfo || {}).find(u => u.components?.hull?.includes(modules.top.hullKey));
    const hullComp = topHullUpgrade?.components || {};

    const secondaryData = parseSecondaryData(ship, hullComp.atba || [], projMap);
    const aircraftData = parseAircraftData(ship, aircraftMap, projMap);
    const submarineData = parseSubmarineData(ship, topHull, hullComp);

    // Sonar & Diving Extraction (p=SON, p=DIV)
    const pingerKey = hullComp.pinger?.[0] || Object.keys(ship).find((k) => k.includes('PingerGun'));
    const topPinger = pingerKey ? ship[pingerKey] : null;
    const sonarData = topPinger ? {
      rangeKm: topPinger.waveDistance ? topPinger.waveDistance / 1000 : null,
      reload: topPinger.waveReloadTime || null,
      traverse180: topPinger.rotationSpeed?.[0] ? Math.round((180 / topPinger.rotationSpeed[0]) * 10) / 10 : null,
      life1: topPinger.sectorParams?.[0]?.lifetime || null,
      life2: topPinger.sectorParams?.[1]?.lifetime || null,
      width: topPinger.waveParams?.[0]?.startWaveWidth || null,
      speed: topPinger.waveParams?.[0]?.waveSpeed?.[0] || 500
    } : null;

    const subDetectability = concealmentSurface && topHull.buoyancyStates
      ? Math.round(concealmentSurface * (topHull.visibilityCoeffUnderwaterDepths?.periscope || 0.4) * 100) / 100
      : null;
    const submergedSpeed = topHull.buoyancyStates?.DEEP_WATER_INVUL
      ? Math.round(topHull.buoyancyStates.DEEP_WATER_INVUL[1] * speed * 10) / 10
      : (submarineData?.submergedSpeed || null);
    const divingPlaneShift = topHull.buoyancyRudderTime
      ? Math.round((topHull.buoyancyRudderTime / 1.305) * 10) / 10
      : null;
    const diveSpeed = topHull.maxBuoyancySpeed
      ? Math.round(topHull.maxBuoyancySpeed * 10) / 10
      : (shipClass === 'Submarine' ? 3.0 : null);
    const diveCapacity = submarineData?.diveCapacity || (shipClass === 'Submarine' ? 250 : null);
    const diveDepletionRate = shipClass === 'Submarine' ? 1.0 : null;
    const diveRechargeRate = submarineData?.diveCapacityRechargeRate || (shipClass === 'Submarine' ? 0.8 : null);

    // Combat Instructions & Innate Skills Extraction (p=CI, p=IS)
    const topSpecialsKey = hullComp.specials?.[0] || Object.keys(ship).find((k) => k.includes('Specials'));
    const topSpecials = topSpecialsKey ? ship[topSpecialsKey] : null;
    const combatInstructions = topSpecials ? {
      name: tr(topSpecials.RageMode?.NAME) || 'Combat Instructions',
      duration: topSpecials.RageMode?.boostDuration || 20
    } : null;

    const topInnateKey = hullComp.innateSkills?.[0] || Object.keys(ship).find((k) => k.includes('Innate'));
    const topInnate = topInnateKey ? ship[topInnateKey] : null;
    const innateSkills = topInnate ? {
      name: tr(Object.values(topInnate)[0]?.NAME) || 'Innate Skill'
    } : null;

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

    let farRange = null, midRange = null, nearRange = null;
    for (const a of auras) {
      if (a.type === 'far') farRange = Math.max(farRange || 0, a.rangeKm);
      else if (a.type === 'medium') midRange = Math.max(midRange || 0, a.rangeKm);
      else if (a.type === 'near') nearRange = Math.max(nearRange || 0, a.rangeKm);
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
      farRange,
      mediumRange: midRange,
      nearRange,
      auras
    } : null;

    // ASW Airstrike & Depth Charge Extraction
    let aswData = null;
    const supportKey = hullComp.airSupport?.[0];
    const supportObj = supportKey ? ship[supportKey] : Object.values(ship).find(v => v && v.chargesNum != null && v.maxDist != null);
    if (supportObj && supportObj.maxDist != null) {
      const maxDistKm = Math.round((supportObj.maxDist / 1000) * 10) / 10;
      const minDistKm = supportObj.minDist ? Math.round((supportObj.minDist / 1000) * 10) / 10 : 0;
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
        minRangeKm: minDistKm,
        reloadTime: reload,
        flightTime,
        payloadCount,
        bombDamage,
        chargesNum: supportObj.chargesNum || 2,
        health: plane?.maxHealth || null,
        floodChance: bomb?.uwCritical ? Math.round(bomb.uwCritical * 100) : null,
        fireChance: bomb?.burnProb ? Math.round(bomb.burnProb * 100) : null,
        penetration: bomb?.alphaPiercingHE || bomb?.alphaPiercingCS || null,
        radius: bomb?.depthSplashRadius ? Math.round(bomb.depthSplashRadius) : 30,
        detonationTimer: bomb?.bulletDetonator || null,
        detonationDepth: bomb?.depthSplashRadius ? Math.round(bomb.depthSplashRadius) : null
      };
    } else if (hullComp.depthCharges?.[0] && ship[hullComp.depthCharges[0]]) {
      const dc = ship[hullComp.depthCharges[0]];
      aswData = {
        type: 'depth_charges',
        rangeKm: 0.5,
        minRangeKm: 0,
        reloadTime: dc.reloadTime || 40,
        flightTime: 0,
        payloadCount: (dc.numShots || 1) * (dc.COMMON?.numBombs || 2),
        bombDamage: 2000,
        chargesNum: dc.maxPacks || 2,
        health: null,
        floodChance: 33,
        fireChance: 0,
        penetration: null,
        radius: 30,
        detonationTimer: null,
        detonationDepth: null
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
          iconKey: `consumable_${variantObj.iconIDs || abil.name}.png`,
          numConsumables: variantObj.numConsumables != null ? variantObj.numConsumables : 3,
          reloadTime: variantObj.reloadTime != null ? variantObj.reloadTime : 120,
          workTime: variantObj.workTime != null ? variantObj.workTime : (variantObj.maxCapacity || 30),
          preparationTime: variantObj.preparationTime || 0,
          lifeCycleType: variantObj.lifeCycleType || 0,
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
      stockSpeed,
      rudderTime,
      stockRudderTime,
      turningRadius,
      stockTurningRadius,
      concealmentSurface,
      concealmentAir,
      concealmentSmoke,
      stockConcealmentSurface,
      stockConcealmentAir,
      stockConcealmentSmoke,
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
      secondary: secondaryData ? {
        rangeKm: secondaryData.rangeKm,
        caliberMm: secondaryData.caliberMm,
        totalBarrels: secondaryData.totalBarrels,
        reload: secondaryData.reload,
        heDpm: secondaryData.heDpm,
        apDpm: secondaryData.apDpm,
        sapDpm: secondaryData.sapDpm,
        fireChance: secondaryData.fireChance,
        penetrationMm: secondaryData.penetrationMm,
        desc: secondaryData.desc,
        hitDpm: secondaryData.hitDpm,
        flightTime: secondaryData.flightTime,
        horizontalDispersion: secondaryData.horizontalDispersion,
        sigma: secondaryData.sigma,
        firesPerMin: secondaryData.firesPerMin,
        shellsPerMinute: secondaryData.shellsPerMinute
      } : null,

      // General Metrics matching shiptool.st (p=GEN)
      year,
      length,
      beam,
      tonnage,
      enginePower,
      powerWeight,
      acceleration,

      // Diving Metrics matching shiptool.st (p=DIV)
      subDetectability,
      submergedSpeed,
      divingPlaneShift,
      diveSpeed,
      diveCapacity,
      diveDepletionRate,
      diveRechargeRate,

      // Sonar & Specials (p=SON, p=CI, p=IS)
      sonar: sonarData,
      combatInstructions,
      hasCombatInstructions: Boolean(combatInstructions),
      innateSkills,
      hasInnateSkills: Boolean(innateSkills),

      // Survivability metrics matching shiptool.st (p=SRV)
      repairPct,
      citadelRepairPct,
      fireResistance,
      fireDuration,
      fireDamage,
      noOfFires,
      torpedoProtection,
      floodingDuration,
      floodingDamage,
      noOfFloodings,

      artillery: artilleryData ? {
        ...toCatalogArtillery(artilleryData),
        stockRangeKm: stockArtilleryData?.rangeKm ?? null,
        stock: toCatalogArtillery(stockArtilleryData)
      } : null,
      torpedoes: torpedoData ? {
        ...toCatalogTorpedoes(torpedoData),
        stock: toCatalogTorpedoes(stockTorpedoData)
      } : null,
      aa: aaData ? {
        maxRange: aaData.maxRange,
        totalDps: aaData.totalDps,
        flakCount: aaData.flakCount,
        nearDps: aaData.nearDps,
        mediumDps: aaData.mediumDps,
        farDps: aaData.farDps,
        flakDamage: aaData.flakDamage,
        farRange: aaData.farRange,
        mediumRange: aaData.mediumRange,
        nearRange: aaData.nearRange
      } : null,
      asw: aswData ? {
        type: aswData.type,
        rangeKm: aswData.rangeKm,
        minRangeKm: aswData.minRangeKm,
        reloadTime: aswData.reloadTime,
        attacks: aswData.chargesNum,
        bombs: aswData.payloadCount,
        damage: aswData.bombDamage,
        flightTime: aswData.flightTime,
        health: aswData.health,
        floodChance: aswData.floodChance,
        fireChance: aswData.fireChance,
        penetration: aswData.penetration,
        radius: aswData.radius,
        detonationTimer: aswData.detonationTimer,
        detonationDepth: aswData.detonationDepth
      } : null,
      aircraft: aircraftData,
      submarine: submarineData,
      consumables: abilities
    };
    catalog.push(catalogItem);

    // Full Details Record (details/[shipId].json)
    const detailsItem = {
      ...catalogItem,
      description: dispDesc,
      resolvedModules: modules,
      artilleryFull: artilleryData,
      artilleryStockFull: stockArtilleryData,
      torpedoesFull: torpedoData,
      torpedoesStockFull: stockTorpedoData,
      secondaryFull: secondaryData,
      aa: aaData,
      asw: aswData,
      aircraft: aircraftData,
      submarine: submarineData,
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
