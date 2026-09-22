import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Calculates armor overmatch threshold in millimeters.
 * Formula: floor(Caliber / 14.3)
 * @param {number} caliberMm Gun caliber in mm (e.g., 460)
 * @returns {number} Maximum armor plate thickness (mm) shell will unconditionally overmatch
 */
export function calculateOvermatch(caliberMm) {
  if (!caliberMm || caliberMm <= 0) return 0;
  return Math.floor(caliberMm / 14.3);
}

/**
 * Calculates Krupp AP penetration using authentic WoWs ballistics formula:
 * Penetration = Krupp * (Mass * v^2)^0.69 * Diameter^-1.07 * 10^-7
 * @param {number} krupp Projectile Krupp value (bulletKrupp)
 * @param {number} massKg Projectile mass in kg (bulletMass)
 * @param {number} velocityMs Velocity in m/s (muzzle or impact velocity)
 * @param {number} diameterM Caliber in meters (bulletDiametr)
 * @returns {number} Penetration in millimeters
 */
export function calculateKruppPenetration(krupp, massKg, velocityMs, diameterM) {
  if (!krupp || !massKg || !velocityMs || !diameterM || velocityMs <= 0) {
    return 0;
  }
  const energy = massKg * Math.pow(velocityMs, 2);
  const pen = krupp * Math.pow(energy, 0.69) * Math.pow(diameterM, -1.07) * 1e-7;
  return Math.round(pen * 10) / 10;
}

/**
 * Precomputes trajectory points from 0km to maxRangeKm at 1km intervals.
 * @param {object} projectile Projectile data object from GameParams
 * @param {number} [maxRangeKm=25] Maximum gun firing range in km
 * @returns {Array<object>} Trajectory curve points
 */
export function computeBallisticsCurve(projectile, maxRangeKm = 25) {
  if (!projectile || projectile.ammoType !== 'AP' || !projectile.TRAJECTORY) {
    return [];
  }

  const krupp = projectile.bulletKrupp;
  const mass = projectile.bulletMass;
  const diameter = projectile.bulletDiametr;
  const muzzleSpeed = projectile.bulletSpeed;
  const traj = projectile.TRAJECTORY;

  const points = [];
  const limitKm = Math.min(Math.ceil(maxRangeKm), (traj.flightTime?.length || 30) - 1);

  for (let d = 0; d <= limitKm; d++) {
    if (d === 0) {
      const pen = calculateKruppPenetration(krupp, mass, muzzleSpeed, diameter);
      points.push({
        distanceKm: 0,
        flightTime: 0,
        impactVelocity: muzzleSpeed,
        impactAngleDeg: 0,
        penetration: pen,
        beltPenetration: pen,
        deckPenetration: 0
      });
      continue;
    }

    const v = traj.impactVelocity ? traj.impactVelocity[d] : null;
    const t = traj.flightTime ? traj.flightTime[d] : null;
    const angleDeg = traj.impactAngle ? traj.impactAngle[d] : 0;

    if (v == null || t == null) {
      continue;
    }

    const rad = (angleDeg * Math.PI) / 180;
    const totalPen = calculateKruppPenetration(krupp, mass, v, diameter);
    const beltPen = calculateKruppPenetration(krupp, mass, v * Math.cos(rad), diameter);
    const deckPen = calculateKruppPenetration(krupp, mass, v * Math.sin(rad), diameter);

    points.push({
      distanceKm: d,
      flightTime: Math.round(t * 100) / 100,
      impactVelocity: Math.round(v * 10) / 10,
      impactAngleDeg: Math.round(angleDeg * 100) / 100,
      penetration: totalPen,
      beltPenetration: beltPen,
      deckPenetration: deckPen
    });
  }

  return points;
}

/**
 * Returns comprehensive ballistic summary for a projectile.
 * @param {object} projectile 
 * @param {number} [maxRangeKm=20]
 * @returns {object}
 */
export function getShellBallisticsSummary(projectile, maxRangeKm = 20) {
  if (!projectile) return null;

  const caliberMm = Math.round((projectile.bulletDiametr || 0) * 1000);
  const overmatch = calculateOvermatch(caliberMm);
  const ammoType = projectile.ammoType || 'HE';

  const baseSummary = {
    name: projectile.name,
    ammoType,
    caliberMm,
    alphaDamage: projectile.alphaDamage || 0,
    bulletSpeed: projectile.bulletSpeed || 0,
    bulletMass: projectile.bulletMass || 0,
    airDrag: projectile.bulletAirDrag || 0,
    overmatchMm: overmatch
  };

  if (ammoType === 'AP') {
    const krupp = projectile.bulletKrupp || 0;
    const muzzlePen = calculateKruppPenetration(krupp, projectile.bulletMass, projectile.bulletSpeed, projectile.bulletDiametr);
    const curve = computeBallisticsCurve(projectile, maxRangeKm);
    
    // Sample distances
    const penAt5km = curve.find(p => p.distanceKm === 5)?.penetration || null;
    const penAt10km = curve.find(p => p.distanceKm === 10)?.penetration || null;
    const penAt15km = curve.find(p => p.distanceKm === 15)?.penetration || null;
    const penAt20km = curve.find(p => p.distanceKm === 20)?.penetration || null;

    return {
      ...baseSummary,
      krupp,
      ricochetStartDeg: projectile.bulletRicochetAt || 45,
      alwaysRicochetDeg: projectile.bulletAlwaysRicochetAt || 60,
      muzzlePenetrationMm: muzzlePen,
      penAt5km,
      penAt10km,
      penAt15km,
      penAt20km,
      curve
    };
  } else if (ammoType === 'HE') {
    return {
      ...baseSummary,
      burnProbability: projectile.burnProb != null ? Math.round(projectile.burnProb * 100) : 0,
      hePenetrationMm: projectile.alphaPiercingHE || Math.floor(caliberMm / 6)
    };
  } else if (ammoType === 'CS') {
    // SAP shell
    return {
      ...baseSummary,
      sapPenetrationMm: projectile.alphaPiercingCS || 0,
      ricochetStartDeg: projectile.bulletRicochetAt || 70,
      alwaysRicochetDeg: projectile.bulletAlwaysRicochetAt || 80
    };
  }

  return baseSummary;
}

// Self-test if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log('Testing calculate_ballistics.mjs...');

  // 1. Overmatch tests
  console.log('Overmatch 460mm (Yamato):', calculateOvermatch(460), 'mm (Expected: 32mm)');
  console.log('Overmatch 406mm (Iowa):', calculateOvermatch(406), 'mm (Expected: 28mm)');
  console.log('Overmatch 380mm (Bismarck):', calculateOvermatch(380), 'mm (Expected: 26mm)');
  console.log('Overmatch 203mm (Des Moines):', calculateOvermatch(203), 'mm (Expected: 14mm)');

  // 2. Krupp Penetration test (Iowa AP at muzzle: 762 m/s, 1225 kg, 0.406 m, Krupp 2520)
  const iowaMuzzlePen = calculateKruppPenetration(2520, 1225, 762, 0.406);
  console.log('Iowa AP muzzle penetration:', iowaMuzzlePen, 'mm (Expected: ~847.6mm)');

  console.log('[OK] Ballistics calculations passed successfully.');
}
