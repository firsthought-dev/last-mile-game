(function () {
  "use strict";
  const S = window.Shiplyp = window.Shiplyp || {};
  const {
    CONFIG, sound, vehicleSpec, isTwoWheeler, isPedalVehicle,
    DeliveryCycleAsset, MotorbikeAsset, RickshawAsset, MuscleCoupeAsset, UI
  } = S;

  class VehicleController {
    constructor(scene, vehicleType = 'cycle') {
      this.scene = scene;
      this.vehicleType = vehicleType;
      this.mesh = new THREE.Group();
      this.wheels = [];

      this.speed = 0;
      this.steerAngle = 0; // now purely cosmetic (wheel turn + body roll), not orientation
      // Free position + heading movement (replaces the old rail model of
      // splineProgress-drives-position + lateralOffset-drives-sideways-
      // drift). `heading` is the car's true world-space yaw — the vehicle
      // can now actually turn, reverse, and maneuver off the road, not
      // just drift sideways within a lane band. splineProgress is kept,
      // but is now a DERIVED value (nearest point on the road curve to the
      // car's actual free position, refreshed each frame by projectToRoad)
      // rather than the thing driving position — every external system
      // that reads it (camera, GPS, autopilot, fence clamp, off-road-lost
      // detection) still gets a meaningful road-relative value.
      this.heading = 0;
      // Direction the car is ACTUALLY travelling, as distinct from `heading`
      // (the direction the body/wheels are pointed). Real cars — and,
      // verified directly from slowroads.io's own shipped bundle, their
      // vehicle model too — let these two diverge under grip loss: tap the
      // brakes into a turn and the tail can still be sliding one way while
      // the nose points another. Before this, `forward` for movement was
      // computed straight from `heading` every frame, so the car always
      // moved exactly where it was pointed with zero momentum carry-through
      // — a big part of why turning felt like a kart on rails rather than a
      // car with weight. See `update()`'s steering block for how this
      // reconverges toward `heading` at a grip-scaled rate each frame.
      this.velocityHeading = 0;
      this.currentPitch = 0; // smoothed chassis dive/squat — 2nd-order spring-damper
      this.pitchVelocity = 0; // angular pitch velocity for 2nd-order suspension
      this.currentRoll = 0;  // smoothed chassis roll — 2nd-order spring-damper
      this.rollVelocity = 0;  // angular roll velocity for 2nd-order suspension
      this.lateralOffset = 0; // still maintained (derived) for banking/ground-height/fence-clamp math
      this.lateralVelocity = 0; // unused by movement now; kept only so any external reset code touching it doesn't throw
      this.grip = 1.0;
      this.health = 100; // Vehicle condition (100% down to 0%)
      this.distanceTraveled = 0;
      // Two mutually exclusive assists (B114). Both default OFF (manual).
      //  isAutodrive — AUTO STEER: the original autopilot; follows the road
      //                and manages speed.
      //  isCruise    — AUTO DRIVE: speed only (speeds up on straights, eases
      //                off for bends ahead); the player still steers.
      this.isAutodrive = false;
      this.isCruise = false;
      this.splineProgress = 0.008;
      this.cycleRideTime = 0;
      this.cycleSteerSpeedPenalty = 0;
      this.smoothSteerInput = 0;

      this.applyVehicleConfig();
      this.buildModel();
      document.body.classList.toggle('vehicle-cycle', isTwoWheeler(vehicleType));
    }

    applyVehicleConfig() {
      const cfg = vehicleSpec(this.vehicleType);
      this.maxSpeed = cfg.maxSpeed;
      this.accel = cfg.accel;
      this.drag = cfg.drag;
      this.brake = cfg.brake;
    }

    setVehicleType(type) {
      if (CONFIG.VEHICLES[type]) {
        this.vehicleType = type;
        this.applyVehicleConfig();
        this.buildModel();
        document.body.classList.toggle('vehicle-cycle', isTwoWheeler(type));
      }
    }

    updateTrolleyParcels(deliveriesMade) {
      if (!this.trolleyParcels || this.trolleyParcels.length === 0) return;
      const totalParcels = this.trolleyParcels.length; // 9 parcels
      // Deplete top parcels first, then middle, then bottom
      const parcelsRemaining = Math.max(1, totalParcels - deliveriesMade);
      this.trolleyParcels.forEach((p, idx) => {
        // Earlier indices are bottom layer, later indices are top layer
        p.visible = idx < parcelsRemaining;
      });
    }


    // Lens meshes are named in Blender (Lens_Head*, Lens_Tail*) so the
    // day/night emissive swap reaches the model's own lamps.
    _bindLensMaterials(model) {
      model.traverse((o) => {
        if (!o.isMesh || !o.name) return;
        if (o.name.startsWith('Lens_Head')) o.material = this.headlightLensMat;
        else if (o.name.startsWith('Lens_Tail')) o.material = this.taillightLensMat;
      });
    }

    // A multi-material wheel loads as a Group plus one child mesh per
    // material, and they share the name prefix, so only the outermost
    // matching node is taken (or the wheel would spin twice). Steered wheels
    // are re-parented under a pivot: the pivot yaws, the wheel rolls, and
    // the two rotations never compose into a wobble.
    _collectWheels(model, wheelRe, steerRe) {
      const found = [];
      model.traverse((o) => {
        if (wheelRe.test(o.name || '') && !wheelRe.test((o.parent && o.parent.name) || '')) found.push(o);
      });
      found.forEach((w) => {
        this.wheels.push(w);
        if (steerRe && steerRe.test(w.name)) {
          const pivot = new THREE.Group();
          pivot.position.copy(w.position);
          w.parent.add(pivot);
          pivot.add(w);
          w.position.set(0, 0, 0);
          this.frontWheels.push(pivot);
        }
      });
    }

    buildModel() {
      this.mesh.clear();
      this.wheels = [];
      this.frontWheels = [];

      // Dynamic automotive projector lens materials:
      // Dark specular glass when OFF; bright warm-white xenon emissive when ON
      this.headlightLensMat = new THREE.MeshStandardMaterial({
        color: 0x141820,
        roughness: 0.15,
        metalness: 0.85,
        emissive: 0x000000,
        emissiveIntensity: 0.0
      });
      this.taillightLensMat = new THREE.MeshStandardMaterial({
        color: 0x5a050d,
        roughness: 0.2,
        metalness: 0.6,
        emissive: 0x220204,
        emissiveIntensity: 0.2
      });

      if (this.vehicleType === 'cycle' && DeliveryCycleAsset.template) {
        const cycleModel = DeliveryCycleAsset.clone();
        // Blender -Y forward exports to glTF +Z forward, so no rotation correction is needed.
        this.mesh.add(cycleModel);
        cycleModel.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        this._collectWheels(cycleModel, /^Wheel_(Front|Rear)/, null);
        // The rear box is a closed thermal box, so there is no open parcel stack to deplete.
        this.trolleyParcels = [];
      } else if (this.vehicleType === 'cycle') {
        if (DeliveryCycleAsset.pendingControllers.indexOf(this) === -1) {
          DeliveryCycleAsset.pendingControllers.push(this);
        }
        const wheelGeom = new THREE.CylinderGeometry(0.44, 0.44, 0.06, 16);
        wheelGeom.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        [[0, 0.44, 0.78], [0, 0.44, -0.82]].forEach(p => {
          const w = new THREE.Mesh(wheelGeom, wheelMat);
          w.position.set(...p);
          this.mesh.add(w);
          this.wheels.push(w);
        });
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.52), new THREE.MeshLambertMaterial({ color: 0xff9f1c }));
        box.position.set(0, 1.05, 0.68);
        this.mesh.add(box);

      } else if (this.vehicleType === 'motorbike' && MotorbikeAsset.template) {
        // ====================================================================
        // MOTORBIKE: built in Blender (B133), seated courier rider baked in.
        // ====================================================================
        const bikeModel = MotorbikeAsset.clone();
        this.mesh.add(bikeModel);
        bikeModel.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
        this._bindLensMaterials(bikeModel);
        this._collectWheels(bikeModel, /^Wheel_(Front|Rear)/, null);
        this.trolleyParcels = [];

      } else if (this.vehicleType === 'motorbike') {
        // Procedural stand-in until MotorbikeAsset loads, then auto-rebuilt.
        if (MotorbikeAsset.pendingControllers.indexOf(this) === -1) {
          MotorbikeAsset.pendingControllers.push(this);
        }
        const wheelGeom = new THREE.CylinderGeometry(0.31, 0.31, 0.09, 16);
        wheelGeom.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        [[0, 0.31, 0.63], [0, 0.31, -0.63]].forEach(p => {
          const w = new THREE.Mesh(wheelGeom, wheelMat);
          w.position.set(...p);
          this.mesh.add(w);
          this.wheels.push(w);
        });
        const tank = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 1.0), new THREE.MeshLambertMaterial({ color: 0x00d4bf }));
        tank.position.set(0, 0.8, 0.1);
        this.mesh.add(tank);

      } else if (this.vehicleType === 'rickshaw' && RickshawAsset.template) {
        // CARGO RICKSHAW (B172): courier baked in; cab roof is part of the model.
        const rickModel = RickshawAsset.clone();
        this.mesh.add(rickModel);
        rickModel.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
        this._bindLensMaterials(rickModel);
        this._collectWheels(rickModel, /^Wheel_(Front|Rear)/, null);
        this.trolleyParcels = [];

      } else if (this.vehicleType === 'rickshaw') {
        // Procedural stand-in until RickshawAsset loads, then auto-rebuilt.
        if (RickshawAsset.pendingControllers.indexOf(this) === -1) {
          RickshawAsset.pendingControllers.push(this);
        }
        const rwGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 14);
        rwGeom.rotateZ(Math.PI / 2);
        const rwMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        [[0, 0.28, -1.25], [-0.64, 0.28, 0.95], [0.64, 0.28, 0.95]].forEach(p => {
          const w = new THREE.Mesh(rwGeom, rwMat);
          w.position.set(...p);
          this.mesh.add(w);
          this.wheels.push(w);
        });
        const rbody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.9), new THREE.MeshLambertMaterial({ color: 0x1062a0 }));
        rbody.position.set(0, 0.9, 0.1);
        this.mesh.add(rbody);

      } else if (this.vehicleType === 'musclecoupe' && MuscleCoupeAsset.template) {
        // ====================================================================
        // 4. MUSCLE COUPE: reworked in Blender (B129) with our own grille,
        // lamps, hood and tail, no badges, new wheels and interior. Real-world
        // scale is baked into the file, so there is no runtime scaling.
        // ====================================================================
        const carModel = MuscleCoupeAsset.clone();
        this.mesh.add(carModel);
        this._bindLensMaterials(carModel);
        this._collectWheels(carModel, /^wheel_[fr]_[lr]/, /^wheel_f_/);

      } else if (this.vehicleType === 'musclecoupe') {
        // Procedural fallback, used only until MuscleCoupeAsset finishes
        // loading, then auto-rebuilt.
        if (MuscleCoupeAsset.pendingControllers.indexOf(this) === -1) {
          MuscleCoupeAsset.pendingControllers.push(this);
        }
        const bodyGeom = new THREE.BoxGeometry(2.0, 0.75, 4.9);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8a1f1f, flatShading: true });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = 0.62;
        body.castShadow = true;
        this.mesh.add(body);

        const wheelGeom = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14);
        wheelGeom.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        [[-1.0, 0.36, 1.6], [1.0, 0.36, 1.6], [-1.0, 0.36, -1.6], [1.0, 0.36, -1.6]].forEach(p => {
          const w = new THREE.Mesh(wheelGeom, wheelMat);
          w.position.set(...p);
          this.mesh.add(w);
          this.wheels.push(w);
        });

      } else {
        // ====================================================================
        // PROCEDURAL BICYCLE (fallback for unknown vehicle types)
        // ====================================================================
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, flatShading: true });
        const tubeGeom = new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8);

        const topTube = new THREE.Mesh(tubeGeom, frameMat);
        topTube.rotation.z = Math.PI / 2;
        topTube.position.set(0, 0.88, 0.0);

        const downTube = new THREE.Mesh(tubeGeom, frameMat);
        downTube.rotation.x = 0.55;
        downTube.position.set(0, 0.62, 0.3);

        const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 8), frameMat);
        seatPost.position.set(0, 0.78, -0.4);

        const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.32), new THREE.MeshLambertMaterial({ color: 0x0f172a }));
        saddle.position.set(0, 1.15, -0.4);

        const fork = new THREE.Mesh(tubeGeom, frameMat);
        fork.rotation.x = -0.35;
        fork.position.set(0, 0.62, 0.78);

        const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.78, 8), new THREE.MeshLambertMaterial({ color: 0x334155 }));
        handlebar.rotation.z = Math.PI / 2;
        handlebar.position.set(0, 1.15, 0.68);

        const rackGeom = new THREE.BoxGeometry(0.38, 0.06, 0.52);
        const rackMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
        const rack = new THREE.Mesh(rackGeom, rackMat);
        rack.position.set(0, 0.88, -0.75);

        const parcelGeom = new THREE.BoxGeometry(0.34, 0.28, 0.4);
        const parcelMat = new THREE.MeshLambertMaterial({ color: 0xff9f1c });
        const parcel = new THREE.Mesh(parcelGeom, parcelMat);
        parcel.position.set(0, 1.05, -0.75);

        this.mesh.add(topTube);
        this.mesh.add(downTube);
        this.mesh.add(seatPost);
        this.mesh.add(saddle);
        this.mesh.add(fork);
        this.mesh.add(handlebar);
        this.mesh.add(rack);
        this.mesh.add(parcel);

        const wheelGeom = new THREE.CylinderGeometry(0.44, 0.44, 0.06, 16);
        wheelGeom.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
        [[0, 0.44, 0.78], [0, 0.44, -0.82]].forEach(p => {
          const w = new THREE.Mesh(wheelGeom, wheelMat);
          w.position.set(...p);
          this.mesh.add(w);
          this.wheels.push(w);
        });
      }

      // Forward Projector Headlights
      const headL = new THREE.SpotLight(0xfff5e6, 0.0, 75, Math.PI / 4.2, 0.85, 1.1);
      headL.position.set(-0.6, 0.55, 1.2);
      headL.target.position.set(-0.35, -0.4, 25);
      headL.visible = false;
      this.mesh.add(headL);
      this.mesh.add(headL.target);

      const headR = new THREE.SpotLight(0xfff5e6, 0.0, 75, Math.PI / 4.2, 0.85, 1.1);
      headR.position.set(0.6, 0.55, 1.2);
      headR.target.position.set(0.35, -0.4, 25);
      headR.visible = false;
      this.mesh.add(headR);
      this.mesh.add(headR.target);

      this.headlights = [headL, headR];
      this.scene.add(this.mesh);
    }

    // Finds the nearest point on the road curve to `pos`, seeded from the
    // last known splineProgress so this is a cheap local search (a window
    // around where the car already was) rather than a full scan every
    // frame — except when the car has moved far off-route (parked off-
    // road, or just spawned), where it widens to a full scan so it can
    // never get stuck locked onto a wrong, distant segment. This is what
    // lets every road-relative system (ground height/banking via
    // World.groundHeightAt, the fence lateral clamp, GPS nearest-target
    // math) keep working correctly now that position is free instead of
    // driven directly by splineProgress.
    projectToRoad(pos, curve, seedU, roadSpacedPoints = null) {
      const totalLen = curve.getLength();
      const search = (uMin, uMax, steps) => {
        let bestU = seedU, bestDistSq = Infinity;
        for (let k = 0; k <= steps; k++) {
          const u = THREE.MathUtils.clamp(uMin + (uMax - uMin) * (k / steps), 0, 1);
          const d = pos.distanceToSquared(curve.getPointAt(u));
          if (d < bestDistSq) { bestDistSq = d; bestU = u; }
        }
        return { bestU, bestDistSq };
      };

      // Speed-scaled local search window (so high speeds never outrun the local window)
      const windowDist = Math.max(50.0, 40.0 + Math.abs(this.speed || 0) * 1.5);
      const windowU = Math.min(0.08, windowDist / Math.max(1, totalLen));
      let { bestU, bestDistSq } = search(seedU - windowU, seedU + windowU, 24);

      // If the local window cannot find a point within 18m, immediately fall back to global search!
      // This prevents getting pinned to the edge of the local window during sharp maneuvers or curve extensions.
      if (Math.sqrt(bestDistSq) > 18.0) {
        if (roadSpacedPoints && roadSpacedPoints.length > 20) {
          const pts = roadSpacedPoints;
          let bestIdx = 0, bestDSq = Infinity;
          for (let i = 0; i < pts.length; i += 3) {
            const dx = pos.x - pts[i].x, dz = pos.z - pts[i].z;
            const d = dx * dx + dz * dz;
            if (d < bestDSq) { bestDSq = d; bestIdx = i; }
          }
          bestU = bestIdx / (pts.length - 1);
          bestDistSq = bestDSq;
        } else {
          ({ bestU, bestDistSq } = search(0, 1, 200));
        }
      }

      // Narrow in on the true nearest point with shrinking local search around bestU
      let refineWindow = (windowU * 2) / 24;
      for (let pass = 0; pass < 4; pass++) {
        ({ bestU, bestDistSq } = search(bestU - refineWindow, bestU + refineWindow, 10));
        refineWindow *= 0.3;
      }

      const u = bestU;
      const pt = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
      const latDist = pos.clone().sub(pt).dot(normal);
      return { u, pt, tangent, normal, latDist, distFromRoad: Math.sqrt(bestDistSq) };
    }

    // Where the road goes ~10-36 m ahead, relative to the current heading.
    // Shared by AUTO STEER (to steer and pick a speed) and AUTO DRIVE (to
    // pick a speed only).
    _roadAhead(world) {
      const curveLength = world.curve.getLength() || 5000;
      const lookaheadMeters = THREE.MathUtils.clamp(10.0 + this.speed * 0.7, 8.0, 36.0);
      const lookaheadU = THREE.MathUtils.clamp(this.splineProgress + (lookaheadMeters / curveLength), 0, 0.999);
      const toTarget = world.curve.getPointAt(lookaheadU).sub(this.mesh.position);
      toTarget.y = 0;
      if (toTarget.lengthSq() <= 0.01) return { headingDiff: 0, turnDeflection: 0, hasTarget: false };
      let headingDiff = Math.atan2(toTarget.x, toTarget.z) - this.heading;
      headingDiff = Math.atan2(Math.sin(headingDiff), Math.cos(headingDiff)); // wrap to [-pi, pi]
      return { headingDiff, turnDeflection: Math.abs(headingDiff), hasTarget: true };
    }

    // Curve-adaptive speed control: accelerate toward a cruise target and
    // slow down automatically when entering sharp turns.
    _applyAutoSpeed(turnDeflection, effectiveMaxSpeed, isBicycle, dt) {
      const cornerSpeedFactor = THREE.MathUtils.clamp(1.0 - (turnDeflection / Math.PI) * 1.5, 0.35, 1.0);
      let autoMaxSpeed = effectiveMaxSpeed;
      if (isBicycle) {
        this.cycleRideTime += dt;
        const cycleCfg = CONFIG.VEHICLES.cycle;
        const escalation = Math.min(this.cycleRideTime / cycleCfg.rampSeconds, 1.0);
        autoMaxSpeed = Math.min(effectiveMaxSpeed, cycleCfg.baseSpeed + (cycleCfg.maxSpeed - cycleCfg.baseSpeed) * escalation);
      }
      const autoTargetSpeed = autoMaxSpeed * (isBicycle ? 0.90 : 0.72) * cornerSpeedFactor;

      if (this.speed < autoTargetSpeed) {
        this.speed += this.accel * dt;
      } else if (this.speed > autoTargetSpeed + 1.0) {
        this.speed -= (this.brake || 30.0) * dt * 0.7;
      }
    }
    update(dt, keys, world, seasonKey = 'autumn') {
      const isRain = (seasonKey === 'autumn' || seasonKey === 'summer');
      const isWind = (seasonKey === 'winter' || seasonKey === 'summer');

      let climateGrip = CONFIG.ROAD_SURFACE.gripMult;
      if (isRain) {
        if (isTwoWheeler(this.vehicleType)) climateGrip *= 0.62;
        else climateGrip *= 0.68;
      }

      const windDrag = isWind ? (isTwoWheeler(this.vehicleType) ? 1.8 : 1.4) : 0.0;

      // 1. Throttle / Acceleration, Service Brakes & Emergency Handbrake
      const isBicycle = isTwoWheeler(this.vehicleType);

      // Health degradation penalty on top speed & engine performance
      const healthFactor = (this.health >= 50) ? 1.0 : Math.max(0.25, 0.4 + 0.6 * (this.health / 50));
      const speedFloor = isBicycle ? 3.0 : 8.0;
      const effectiveMaxSpeed = (this.health <= 0) ? 0.0 : Math.max(speedFloor, (this.maxSpeed - windDrag * (isBicycle ? 0.8 : 3.5)) * healthFactor);
      // B171: Space is also the parcel-drop key, so it must not slam the brakes (or break traction) while a drop is
      // in range. The handbrake still works everywhere else.
      let spaceBrake = !!keys.space;
      if (spaceBrake && typeof window !== 'undefined' && window.game && window.game._findTossTarget && this.mesh) {
        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion).normalize();
        if (window.game._findTossTarget(this.mesh.position, fwd)) spaceBrake = false;
      }
      const isDrifting = spaceBrake;
      const driftGripMult = isDrifting ? 0.40 : 1.0; // 60% friction reduction during power-slide drift

      // Safety Override: Driver pressing the brake pedal disengages Autopilot.
      // Space (handbrake/parcel-toss) intentionally excluded — players toss
      // parcels while autopilot is active, and button-focus causes the browser
      // to re-fire Space when a HUD button has keyboard focus.
      if ((this.isAutodrive || this.isCruise) && (keys.down || keys.s)) {
        this.isAutodrive = false;
        this.isCruise = false;
        if (typeof window !== 'undefined') window.game?.updateAutoAssistHUD?.();
      }

      if (this.isAutodrive) {
        // Curve-adaptive pure pursuit autopilot: look ahead by a dynamic distance
        // scaled with forward speed (~12m at low speed, ~35m at top speed), avoiding
        // jumping across hairpin loops. We also slow down on tight curves to prevent
        // understeering or spinning into the guardrails.
        const { headingDiff, turnDeflection, hasTarget } = this._roadAhead(world);
        if (hasTarget) {
          // Speed-scaled turn rate: allow sharper turn rate at moderate/low speed, stable at high speed
          const autopilotTurnRate = 2.4 * climateGrip;
          const turnStep = THREE.MathUtils.clamp(headingDiff, -autopilotTurnRate * dt, autopilotTurnRate * dt);
          this.heading += turnStep;

          // Steer angle follows commanded turning rate for realistic wheel angle & dynamics
          const targetSteerAngle = THREE.MathUtils.clamp(headingDiff * 0.8, -0.42, 0.42);
          this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteerAngle, 0.22);
        } else {
          this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, 0, 0.16);
        }

        this._applyAutoSpeed(turnDeflection, effectiveMaxSpeed, isBicycle, dt);
      } else {
        if (this.isCruise && this.health > 0) {
          // AUTO DRIVE: speed only. Same curve-aware target speed as Auto
          // Steer, but measured against the player's own heading, so it
          // eases off when a bend is coming up or the rider points off-road.
          this._downBrakingFromForward = false;
          this._applyAutoSpeed(this._roadAhead(world).turnDeflection, effectiveMaxSpeed, isBicycle, dt);
        } else if (this.health <= 0) {
          // Engine breakdown stall
          this.speed *= Math.exp(-2.5 * dt);
          if (Math.abs(this.speed) < 0.1) this.speed = 0;
        } else if (spaceBrake) {
          // SPACE: EMERGENCY HANDBRAKE (not while a drop is in range, see above) — Powerful deceleration and unconditional full halt
          if (Math.abs(this.speed) > 0.08) {
            const hBrake = (this.brake || 30.0) * dt * 2.5;
            if (this.speed > 0) this.speed = Math.max(0, this.speed - hBrake);
            else this.speed = Math.min(0, this.speed + hBrake);
          } else {
            this.speed = 0;
          }
          this._downBrakingFromForward = false;
        } else if (keys.down || keys.s) {
          // DOWN / S: BRAKE WHEN MOVING FORWARD, HOLD AT FULL STOP
          // (Prioritized over throttle — brake pedal always overrides gas)
          if (this.speed > 0.08) {
            // Moving forward — apply service brakes with high authority down to 0
            this._downBrakingFromForward = true;
            this.speed -= (this.brake || 30.0) * dt * climateGrip * 2.0;
            if (this.speed <= 0.08) {
              this.speed = 0;
            }
          } else if (this._downBrakingFromForward) {
            // Held DOWN through forward braking to a complete stop:
            // KEEP VEHICLE AT A FULL HALT (VEHICLE HOLD MODE).
            // Driver must release S and press again to engage reverse gear.
            this.speed = 0;
          } else if (this.speed < -0.08) {
            // Already in reverse — reverse acceleration up to reverse limit
            const reverseMax = -5.0;
            this.speed += (reverseMax - this.speed) * (1 - Math.exp(-1.2 * dt));
          } else {
            // At standstill and DOWN was NOT held from forward braking:
            // Fresh intentional press to reverse
            const reverseMax = -5.0;
            this.speed += (reverseMax - this.speed) * (1 - Math.exp(-1.2 * dt));
          }
        } else if (keys.up || keys.w) {
          // UP / W: ACCELERATE FORWARD (or brake reverse motion to a full stop)
          this._downBrakingFromForward = false;
          if (this.speed < -0.08) {
            // Reversing — pressing forward throttle acts as brake to bring vehicle to a full stop
            this.speed += (this.brake || 30.0) * dt * 2.4;
            if (this.speed >= -0.08) this.speed = 0;
          } else if (isPedalVehicle(this.vehicleType)) {
            try {
              this.cycleRideTime += dt;
              const cycleCfg = CONFIG.VEHICLES.cycle;
              const escalation = Math.min(this.cycleRideTime / cycleCfg.rampSeconds, 1.0);
              const targetBaseSpeed = cycleCfg.baseSpeed + (cycleCfg.maxSpeed - cycleCfg.baseSpeed) * escalation;

              // cycleSteerSpeedPenalty is updated in the steering block below (once per step).
              const cycleMax = Math.min(effectiveMaxSpeed, targetBaseSpeed * (1.0 - (this.cycleSteerSpeedPenalty || 0)));
              const cadenceRatio = Math.max(0.2, 1.0 - Math.pow(Math.min(1.0, this.speed / Math.max(0.1, cycleMax)), 1.5));
              const cyclePush = this.accel * cadenceRatio * climateGrip;
              this.speed = Math.min(cycleMax, this.speed + cyclePush * dt);
              if (this.speed > cycleMax) {
                this.speed = Math.max(cycleMax, this.speed - (this.drag * 1.5 + 0.5) * dt);
              }
            } catch (err) {
              console.error('Error in cycle speed calculation:', err);
            }
          } else {
            // Multi-gear progressive torque for cars: punchy 1st/2nd gear low-end torque, tapering at high gear
            const speedRatio = THREE.MathUtils.clamp(this.speed / effectiveMaxSpeed, 0, 1);
            const gearTorqueMult = THREE.MathUtils.lerp(1.5, 0.65, Math.pow(speedRatio, 0.7));
            const carPush = this.accel * gearTorqueMult * climateGrip;
            this.speed = Math.min(effectiveMaxSpeed, this.speed + carPush * dt);
          }
        } else {
          // Natural coasting / drag; clear hold mode so fresh press can reverse
          this._downBrakingFromForward = false;
          const rollingDrag = isPedalVehicle(this.vehicleType) ? this.drag * 0.30 : this.drag * 0.85;
          this.speed *= Math.exp(-rollingDrag * dt);
          if (Math.abs(this.speed) < 0.08) this.speed = 0;
        }

        // 2. FREE STEERING — completely separate physics for cycle vs car.
        if (isBicycle) {
          // ============================================================
          // BICYCLE STEERING — smooth progressive analog handlebar model.
          // Fluid path-following with progressive steering inertia.
          // ============================================================

          // Analog input: keys.steerInput is −1 to +1 from touch drag zone;
          // keyboard left/right feed as ±1.0 digital fallback.
          let rawSteer = keys.steerInput || 0;
          if (!rawSteer) {
            if (keys.left || keys.a) rawSteer = 1.0;
            else if (keys.right || keys.d) rawSteer = -1.0;
          }

          // Smooth steering input filter to eliminate sudden snap/jerks on keyboard and touch
          const steerFilterRate = rawSteer !== 0 ? 8.5 : 12.0;
          this.smoothSteerInput = THREE.MathUtils.lerp(this.smoothSteerInput || 0, rawSteer, 1.0 - Math.exp(-steerFilterRate * dt));

          // Steer penalty tracking while coasting as well
          const steerIntensity = Math.min(1.0, Math.abs(rawSteer));
          if (steerIntensity > 0.05) {
            const targetPenalty = steerIntensity * 0.05;                 // B171: was 0.15; a keyboard key counts as full steering
            this.cycleSteerSpeedPenalty = THREE.MathUtils.lerp(this.cycleSteerSpeedPenalty || 0, targetPenalty, 0.20);
          } else {
            this.cycleSteerSpeedPenalty = Math.max(0, (this.cycleSteerSpeedPenalty || 0) - (dt / 0.5) * 0.05);
          }

          // Bicycle turn rate: nimble and progressive, perfectly balanced for road curves
          const cycleBaseTurn = 1.65;
          const absSpd = Math.abs(this.speed);
          const lowSpeedRamp = THREE.MathUtils.clamp(absSpd / 2.0, 0.30, 1.0);
          const highSpeedTaper = THREE.MathUtils.clamp(1.0 - (absSpd - 10.0) / 18.0, 0.50, 1.0);
          const reverseFlip = this.speed < -0.05 ? -1 : 1;
          const cycleTurnRate = cycleBaseTurn * lowSpeedRamp * highSpeedTaper * reverseFlip * climateGrip;

          // Apply heading change with smooth progressive steering
          this.heading += this.smoothSteerInput * cycleTurnRate * dt;

          // Steer angle (cosmetic handlebar + lean): smooth natural response
          const cycleSteerLimit = 0.50 * climateGrip;
          const targetSteer = this.smoothSteerInput * cycleSteerLimit;
          const steerLerpRate = 1.0 - Math.exp(-12.0 * dt);
          this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, steerLerpRate);

        } else {
          // ============================================================
          // CAR / TRUCK STEERING — heavier, grip-limited, drift-capable.
          // ============================================================
          const carBaseTurnRate = 1.55;
          const carTurnRateLimit = carBaseTurnRate * (isDrifting ? 1.4 : 1.0) * climateGrip;
          const carSpeedScale = THREE.MathUtils.clamp(Math.abs(this.speed) / 6.0, 0.25, 1.0);
          const carReverseFlip = this.speed < -0.05 ? -1 : 1;
          const carTurnRate = carTurnRateLimit * carSpeedScale * carReverseFlip;

          const carSteerResponse = isDrifting ? 0.24 : 0.18;
          const carSteerLimit = (isDrifting ? 0.65 : 0.42) * climateGrip;
          if (keys.left || keys.a) {
            this.heading += carTurnRate * dt;
            this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, carSteerLimit, carSteerResponse);
          } else if (keys.right || keys.d) {
            this.heading -= carTurnRate * dt;
            this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, -carSteerLimit, carSteerResponse);
          } else {
            this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, 0, 0.14);
          }
        }
      }

      // 2b. Tire Slip Friction — separate models for bicycle vs car.
      let headingDelta = this.heading - this.velocityHeading;
      headingDelta = Math.atan2(Math.sin(headingDelta), Math.cos(headingDelta));
      this.driftAngle = headingDelta;

      if (isBicycle) {
        // Bicycle: tighter grip, less slide than a car, but with enough
        // lag for satisfying momentum carry-through on direction changes.
        // At low speed, nearly instant tracking; at high speed, slight drift.
        const speedRatio = THREE.MathUtils.clamp(Math.abs(this.speed) / 20.0, 0, 1);
        const cycleConverge = this.isAutodrive ? 14.0 : THREE.MathUtils.lerp(18.0, 8.0, speedRatio) * climateGrip;
        this.velocityHeading += headingDelta * (1 - Math.exp(-cycleConverge * dt));
      } else {
        // Car: heading convergence slows with heading error, allowing drift
        const lateralEfficiency = THREE.MathUtils.clamp(1.0 - Math.abs(headingDelta) * 0.45, 0.25, 1.0);
        const carConvergeRate = this.isAutodrive
          ? 14.0
          : (8.8 * climateGrip * driftGripMult * lateralEfficiency);
        this.velocityHeading += headingDelta * (1 - Math.exp(-carConvergeRate * dt));
      }

      // 3. Move freely along the car's actual direction of travel
      const moveDist = this.speed * dt;
      this.distanceTraveled += Math.abs(moveDist) * 0.001;
      const forward = new THREE.Vector3(Math.sin(this.velocityHeading), 0, Math.cos(this.velocityHeading));
      const proposedPos = this.mesh.position.clone().addScaledVector(forward, moveDist);

      const proj = this.projectToRoad(proposedPos, world.curve, this.splineProgress, world.roadSpacedPoints);
      this.splineProgress = proj.u;

      // Slow Roads Barrier Interaction: Smooth Elastic Glancing & Inward Deflection
      const side = proj.latDist >= 0 ? 1 : -1;
      // getLateralClamp reserves a car's 1.05 m half-width; a bicycle is ~0.4 m,
      // so it gets the difference back instead of hitting an invisible wall.
      const clampDist = (world.getLateralClamp ? world.getLateralClamp(proj.u, side) : 9.0) + (isBicycle ? 0.65 : 0.0);
      let vehiclePos = proposedPos;
      let latDist = proj.latDist;

      const roadFwdHeading = Math.atan2(proj.tangent.x, proj.tangent.z);
      const headingVsRoad = Math.abs(Math.atan2(Math.sin(this.heading - roadFwdHeading), Math.cos(this.heading - roadFwdHeading)));
      const isTurningAcrossRoad = headingVsRoad > Math.PI * 0.4;

      const overshoot = Math.abs(latDist) - clampDist;
      if (overshoot > 0.35 && !isTurningAcrossRoad && (proj.distFromRoad || 0) < 28) {
        // Far outside the limit — the limit narrowed under us (end of a fence
        // gap at a delivery house). Ease back in instead of teleporting.
        const toProposed = proposedPos.clone().sub(proj.pt);
        const fwdComponent = toProposed.dot(proj.tangent);
        latDist = side * (Math.abs(latDist) - overshoot * (1.0 - Math.exp(-6.0 * dt)));
        vehiclePos = proj.pt.clone().addScaledVector(proj.tangent, fwdComponent).addScaledVector(proj.normal, latDist);
        const reproj = this.projectToRoad(vehiclePos, world.curve, proj.u, world.roadSpacedPoints);
        Object.assign(proj, reproj);
        this.splineProgress = proj.u;
      } else if (overshoot > 0 && !isTurningAcrossRoad && (proj.distFromRoad || 0) < 28) {
        const toProposed = proposedPos.clone().sub(proj.pt);
        const fwdComponent = toProposed.dot(proj.tangent);
        latDist = clampDist * side;
        vehiclePos = proj.pt.clone().addScaledVector(proj.tangent, fwdComponent).addScaledVector(proj.normal, latDist);

        const reproj = this.projectToRoad(vehiclePos, world.curve, proj.u, world.roadSpacedPoints);
        Object.assign(proj, reproj);
        this.splineProgress = proj.u;

        const tangentHeading = Math.atan2(proj.tangent.x, proj.tangent.z);
        let headingDiffFwd = tangentHeading - this.heading;
        headingDiffFwd = Math.atan2(Math.sin(headingDiffFwd), Math.cos(headingDiffFwd));
        let headingDiffBck = (tangentHeading + Math.PI) - this.heading;
        headingDiffBck = Math.atan2(Math.sin(headingDiffBck), Math.cos(headingDiffBck));
        const headingDiff = Math.abs(headingDiffFwd) <= Math.abs(headingDiffBck) ? headingDiffFwd : headingDiffBck;

        // Glance along the barrier: ease parallel rather than snapping (was a
        // 12/s align plus an instant velocityHeading reset, read as a jolt).
        const alignRate = 1.0 - Math.exp(-2.5 * dt);
        const barrierYaw = headingDiff * alignRate;
        this.heading += barrierYaw;
        // Being pushed off the barrier isn't a steered turn — keep it out of the lean.
        this._barrierYawThisStep = (this._barrierYawThisStep || 0) + barrierYaw;
        let velDiff = this.heading - this.velocityHeading;
        velDiff = Math.atan2(Math.sin(velDiff), Math.cos(velDiff));
        this.velocityHeading += velDiff * (1.0 - Math.exp(-8.0 * dt));

        if (this.steerAngle * side > 0) {
          this.steerAngle *= Math.exp(-6.0 * dt);
        }

        // B140: hitting the barrier costs speed. A fresh impact (not already
        // scraping, short cooldown) takes a chunk; scraping along drags more.
        const nowMs = performance.now();
        if (!this._onBarrier && Math.abs(this.speed) > 4 && nowMs - (this._lastBarrierHitMs || 0) > 600) {
          this.speed *= CONFIG.BARRIER_HIT_SPEED_KEEP;
          this._lastBarrierHitMs = nowMs;
        }
        this._onBarrier = true;
        this.speed *= Math.max(0.6, 1.0 - CONFIG.BARRIER_SCRAPE_DRAG * dt);
        if (Math.abs(this.speed) > 4) sound.playBarrierScrape();
      } else {
        this._onBarrier = false;
      }
      this.lateralOffset = latDist;

      const tangent = proj.tangent;

      // 4-Wheel Contact Ground Plane Evaluation
      const _vSpec = vehicleSpec(this.vehicleType);
      const halfWheelbase = _vSpec.halfWheelbase || (isBicycle ? 0.95 : 1.45);
      const halfTrack = _vSpec.halfTrack || (isBicycle ? 0.25 : 0.82);
      const carHeading = this.heading;
      const carFwd = new THREE.Vector3(Math.sin(carHeading), 0, Math.cos(carHeading));
      const carRight = new THREE.Vector3(Math.cos(carHeading), 0, -Math.sin(carHeading));

      const wheelOffsets = [
        { fwd: halfWheelbase, right: -halfTrack },
        { fwd: halfWheelbase, right: halfTrack },
        { fwd: -halfWheelbase, right: -halfTrack },
        { fwd: -halfWheelbase, right: halfTrack }
      ];

      const wheelWorldPos = wheelOffsets.map(o => {
        const wp = vehiclePos.clone().addScaledVector(carFwd, o.fwd).addScaledVector(carRight, o.right);
        const wProj = this.projectToRoad(wp, world.curve, this.splineProgress);
        const wGroundY = world.getRoadSurfaceHeight
          ? world.getRoadSurfaceHeight(wProj.pt, wp, wProj.latDist, wProj.u)
          : world.groundHeightAt(wProj.pt, wp, wProj.latDist);
        return { wp, wProj, y: wGroundY };
      });

      const yFL = wheelWorldPos[0].y;
      const yFR = wheelWorldPos[1].y;
      const yRL = wheelWorldPos[2].y;
      const yRR = wheelWorldPos[3].y;

      const avgFrontY = (yFL + yFR) * 0.5;
      const avgRearY = (yRL + yRR) * 0.5;
      const avgLeftY = (yFL + yRL) * 0.5;
      const avgRightY = (yFR + yRR) * 0.5;
      const trueGroundCenterY = (yFL + yFR + yRL + yRR) * 0.25;

      const trueRoadPitch = Math.atan2(avgFrontY - avgRearY, halfWheelbase * 2.0);
      const trueRoadRoll = Math.atan2(avgRightY - avgLeftY, halfTrack * 2.0);

      // Controlled throttle dive/squat
      let throttlePitch = 0;
      if (keys.w || keys.up) {
        throttlePitch = isBicycle ? 0.008 : 0.016;
      } else if (keys.s || keys.down) {
        throttlePitch = isBicycle ? -0.012 : -0.024;
      }

      const targetPitch = -trueRoadPitch - throttlePitch;

      // Bicycle inward lean vs car centrifugal body roll — separated.
      let dynamicRoll = 0;
      if (isBicycle) {
        // A cyclist leans relative to GRAVITY, not the road surface, so road
        // banking only bleeds through slightly. The lean itself is the balance
        // angle for the ACTUAL turn (player steer or a road bend on autopilot):
        // tan(lean) = v * yawRate / g.
        try {
          const prevHeading = (this._leanPrevHeading === undefined) ? this.heading : this._leanPrevHeading;
          const dHeading = Math.atan2(Math.sin(this.heading - prevHeading), Math.cos(this.heading - prevHeading)) - (this._barrierYawThisStep || 0);
          this._barrierYawThisStep = 0;
          this._leanPrevHeading = this.heading;
          const rawYawRate = dt > 0 ? THREE.MathUtils.clamp(dHeading / dt, -3.0, 3.0) : 0;
          this._leanYawRate = THREE.MathUtils.lerp(this._leanYawRate || 0, rawYawRate, 1.0 - Math.exp(-12.0 * dt));
          const MAX_LEAN = 0.56; // 32 deg
          const balanceLean = Math.atan((this.speed * this._leanYawRate) / 9.81);
          const inwardLean = -THREE.MathUtils.clamp(balanceLean, -MAX_LEAN, MAX_LEAN);
          dynamicRoll = trueRoadRoll * 0.12 + inwardLean;
        } catch (err) {
          console.error('Cycle lean calculation failed:', err);
          dynamicRoll = trueRoadRoll * 0.12;
        }
      } else {
        const centrifugalBodyRoll = this.steerAngle * (this.speed / (this.maxSpeed || 40)) * (vehicleSpec(this.vehicleType).bodyRoll || 0.12);
        dynamicRoll = trueRoadRoll + centrifugalBodyRoll;
      }

      const targetRoll = dynamicRoll;
      const targetPitchWithJitter = targetPitch;

      // 2nd-Order Spring-Mass-Damper Suspension Filter
      const subDt = Math.min(dt, 0.05);
      const omegaPitch = isBicycle ? 13.0 : 16.0;
      const zetaPitch = isBicycle ? 1.05 : 0.90;
      const pitchAccel = (omegaPitch * omegaPitch) * (targetPitchWithJitter - this.currentPitch) - 2.0 * zetaPitch * omegaPitch * this.pitchVelocity;
      this.pitchVelocity += pitchAccel * subDt;
      this.currentPitch += this.pitchVelocity * subDt;

      const omegaRoll = isBicycle ? 14.0 : 16.0;
      const zetaRoll = isBicycle ? 1.05 : 0.88;
      const rollAccel = (omegaRoll * omegaRoll) * (targetRoll - this.currentRoll) - 2.0 * zetaRoll * omegaRoll * this.rollVelocity;
      this.rollVelocity += rollAccel * subDt;
      this.currentRoll += this.rollVelocity * subDt;

      vehiclePos.y = trueGroundCenterY + (isBicycle ? 0.04 : 0.02);
      this.mesh.position.copy(vehiclePos);

      // Set chassis orientation: heading yaw + true 4-wheel pitch & roll
      this.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
      this.mesh.rotateX(this.currentPitch);
      this.mesh.rotateZ(this.currentRoll);

      if (isBicycle) {
        // ============================================================
        // BICYCLE VISUAL DYNAMICS — purely rotational, never touches
        // position.y (that's owned by the ground-height system).
        // ============================================================
        const absSpeed = Math.abs(this.speed);
        const isPedaling = (keys.up || keys.w) && absSpeed > 0.5;
        const time = performance.now() * 0.001;

        // Realistic human pedaling cadence: ~65-85 RPM (1.1 - 1.45 Hz)
        const pedalFreq = isPedaling ? THREE.MathUtils.lerp(1.1, 1.45, Math.min(absSpeed / 18.06, 1.0)) : 0;

        // 1. Pedaling pitch rock: subtle organic forward-back nod during pedal strokes
        if (isPedaling) {
          const pitchAmp = THREE.MathUtils.lerp(0.004, 0.002, Math.min(absSpeed / 10.0, 1.0));
          this.mesh.rotateX(Math.sin(time * pedalFreq * Math.PI * 2) * pitchAmp);
        }

        // 2. Pedaling lateral rock: gentle rhythmic side-to-side sway
        if (isPedaling) {
          const rockAmp = THREE.MathUtils.lerp(0.005, 0.0025, Math.min(absSpeed / 10.0, 1.0));
          this.mesh.rotateZ(Math.sin(time * pedalFreq * 0.5 * Math.PI * 2) * rockAmp);
        }

        // 3. Handlebar counter-steer: subtle yaw when steering
        if (Math.abs(this.steerAngle) > 0.01) {
          this.mesh.rotateY(-this.steerAngle * 0.04);
        }
      }

      // 4-Wheel Visual Dynamics (cars):
      if (!isBicycle && this.frontWheels && this.frontWheels.length > 0) {
        this.frontWheels.forEach(w => {
          w.rotation.y = this.steerAngle * 0.85;
        });
      }
      // Spin all wheels along pitch axis with forward ground speed
      if (this.wheels && this.wheels.length > 0) {
        const wheelRadius = (CONFIG.VEHICLES[this.vehicleType] || {}).wheelRadius || 0.38;
        this.wheels.forEach(w => w.rotateX((this.speed * dt) / wheelRadius));
      }

      const carPos = this.mesh.position;

      // Speed camera / E-Challan fine system removed — caught live during
      // verification driving at 114 km/h (a normal speed for this game, not
      // a punishable one): fired a "-₹150 E-CHALLAN" notification, which is
      // courier-fine framing the slowroads-style pivot doesn't want. The
      // gantry props are left in place
      // (still a visible roadside structure — decorative overhead gantry),
      // only the speed-triggered fine/flash/notification behavior is gone.

      // 6. Roadside Garage Pitstop Repair Bay
      if (world.repairBays) {
        world.repairBays.forEach(bay => {
          const d = carPos.distanceTo(bay.pos);
          if (d < bay.radius && !bay.visitedRecently) {
            if (this.health < 100) {
              bay.visitedRecently = true;
              this.health = 100;
              sound.playRepair();
              if (window.game) {
                window.game.addNotification(`${UI.icon('wrench')} FULL SERVICE COMPLETED! Health 100%`, 'success', 3500);
              }
              setTimeout(() => { bay.visitedRecently = false; }, 5000);
            }
          }
        });
      }

      // 7. Environment collision disabled — collisions now restricted to potholes/debris only
      // Tree, rock, pole, and building collisions removed per design.
    }

    resetToSpline(curve, startU = 0.008, preserveSpeed = false) {
      const prevSpeed = this.speed;
      this.splineProgress = (startU !== undefined && startU !== null) ? startU : 0.008;
      this.lateralOffset = 0;
      this.lateralVelocity = 0;
      const pt = curve.getPointAt(this.splineProgress);
      const tangent = curve.getTangentAt(this.splineProgress).normalize();
      this.mesh.position.copy(pt);
      // Matches groundHeightAt(pt.y - 0.18) + roadSlabLift(0.12) + rideHeightBuffer(0.08) = pt.y + 0.02
      this.mesh.position.y = pt.y + 0.02;
      this.heading = Math.atan2(tangent.x, tangent.z);
      this.velocityHeading = this.heading;
      this._leanPrevHeading = this.heading;
      this._leanYawRate = 0;
      this.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
      this.speed = preserveSpeed ? prevSpeed : 0;
      if (!preserveSpeed) this.cycleRideTime = 0;
      this.steerAngle = 0;
      this.currentPitch = 0;
      this.currentRoll = 0;
      this.pitchVelocity = 0;
      this.rollVelocity = 0;
      this.health = Math.max(75, this.health);
    }

    snapToNearestRoadPoint(curve) {
      const SCAN = 120;
      let bestU = this.splineProgress;
      let bestDist = Infinity;
      const pos = this.mesh.position;
      for (let k = 0; k <= SCAN; k++) {
        const u = k / SCAN;
        const candidate = curve.getPointAt(u);
        const d = pos.distanceToSquared(candidate);
        if (d < bestDist) { bestDist = d; bestU = u; }
      }
      this.splineProgress = bestU;
      this.lateralOffset = 0;
      this.lateralVelocity = 0;
      const pt = curve.getPointAt(bestU);
      const tangent = curve.getTangentAt(bestU).normalize();
      this.mesh.position.copy(pt);
      this.mesh.position.y = pt.y + 0.02;
      this.heading = Math.atan2(tangent.x, tangent.z);
      this.velocityHeading = this.heading;
      this._leanPrevHeading = this.heading;
      this._leanYawRate = 0;
      this.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
      this.speed = 0;
      this.steerAngle = 0;
      this.currentPitch = 0;
      this.currentRoll = 0;
      this.pitchVelocity = 0;
      this.rollVelocity = 0;
    }

    setHeadlightsActive(active, intensity = 3.2) {
      if (this.headlights) {
        this.headlights.forEach(h => {
          h.visible = !!active;
          h.intensity = active ? intensity : 0.0;
        });
      }
      if (this.headlightLensMat) {
        if (active) {
          this.headlightLensMat.color.setHex(0xffffff);
          this.headlightLensMat.emissive.setHex(0xfff5e6);
          this.headlightLensMat.emissiveIntensity = 2.8;
        } else {
          this.headlightLensMat.color.setHex(0x141820);
          this.headlightLensMat.emissive.setHex(0x000000);
          this.headlightLensMat.emissiveIntensity = 0.0;
        }
      }
      if (this.taillightLensMat) {
        if (active) {
          this.taillightLensMat.emissive.setHex(0xef233c);
          this.taillightLensMat.emissiveIntensity = 1.8;
        } else {
          this.taillightLensMat.emissive.setHex(0x220204);
          this.taillightLensMat.emissiveIntensity = 0.2;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 6B. RAIN — a bounded particle volume that rides with the camera
  // --------------------------------------------------------------------------
  // Mechanics reused from slowroads' snow EXACTLY (soft round point-
  // sprites, perspective-attenuated size, volume tied to vehicle position
  // so it keeps falling/recentering regardless of speed, respawn on exit)
  // — confirmed directly by re-checking the reference at idle, ~70km/h,
  // and ~104km/h: snow stays vertical round dots with only slight wind
  // drift at every speed tested, no streaking or lean at any velocity.
  // Slowroads has no rain to copy directly (Overcast + any non-winter
  // season produces zero precipitation there).
  //
  // Two explicit, deliberate differences from snow, per direct
  // instruction (not present in the slowroads reference, added anyway):
  // faster fall speed + higher count (rain is denser than snow), and a
  // speed-proportional backward bend — perfectly vertical at rest,
  // leaning further back as the vehicle's own speed increases. This is
  // real physics (a raindrop falls straight in the world frame; in a
  // frame moving forward at speed v it acquires an apparent backward
  // horizontal velocity of v, the same reason rain looks slanted through
  // a moving car's windshield) even though slowroads' own snow doesn't
  // model it for the vehicle it rides with.
  //
  // THREE.Points (not InstancedMesh) — camera-facing sprites are the
  // correct primitive for a round dot with size falloff; a streak needed
  // real 3D geometry to read as a line from any angle, a round dot doesn't.
  // The soft circular alpha falloff is generated on a canvas at runtime
  // (matching what a live capture of slowroads showed — no snowflake
  // texture asset was ever downloaded there, so it's some form of
  // procedural point rendering, not a bundled sprite).

  S.VehicleController = VehicleController;
})();
