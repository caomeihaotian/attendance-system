"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, Stars } from "@react-three/drei";
import * as THREE from "three";

interface Student {
  id: string;
  name: string;
  studentId: string | null;
}

interface ParticleFieldProps {
  students: Student[];
  phase: "idle" | "spinning" | "revealing" | "done";
  selectedName: string;
  onPhaseChange: (phase: "idle" | "spinning" | "revealing" | "done") => void;
}

function ParticleField({ students, phase, selectedName, onPhaseChange }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const count = Math.min(students.length * 20, 3000);

  const { positions, initialPositions } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const init = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3 + Math.random() * 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      init[i * 3] = pos[i * 3];
      init[i * 3 + 1] = pos[i * 3 + 1];
      init[i * 3 + 2] = pos[i * 3 + 2];
    }
    return { positions: pos, initialPositions: init };
  }, [count]);

  const colors = useMemo(() => {
    const cols = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const hue = Math.random();
      const c = new THREE.Color().setHSL(hue, 0.8, 0.6);
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    return cols;
  }, [count]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    timeRef.current += delta;
    const posAttr = pointsRef.current.geometry.attributes.position;
    const pos = posAttr.array as Float32Array;

    if (phaseRef.current === "idle") {
      for (let i = 0; i < count; i++) {
        pos[i * 3] = initialPositions[i * 3] + Math.sin(timeRef.current * 0.5 + i * 0.1) * 0.1;
        pos[i * 3 + 1] = initialPositions[i * 3 + 1] + Math.cos(timeRef.current * 0.3 + i * 0.1) * 0.1;
        pos[i * 3 + 2] = initialPositions[i * 3 + 2];
      }
      pointsRef.current.rotation.y += delta * 0.1;
    } else if (phaseRef.current === "spinning") {
      const speed = Math.min(timeRef.current * 0.5, 3);
      for (let i = 0; i < count; i++) {
        const angle = timeRef.current * speed + i * 0.02;
        const r = Math.max(0.5, 3 + Math.sin(timeRef.current + i) * 2 - timeRef.current * 0.2);
        pos[i * 3] = r * Math.cos(angle + i * 0.1);
        pos[i * 3 + 1] = r * Math.sin(angle * 0.7 + i * 0.1) * 0.5;
        pos[i * 3 + 2] = r * Math.sin(angle + i * 0.1);
      }
      pointsRef.current.rotation.y += delta * 2;

      if (timeRef.current > 2.5) {
        timeRef.current = 0;
        onPhaseChange("revealing");
      }
    } else if (phaseRef.current === "revealing") {
      for (let i = 0; i < count; i++) {
        pos[i * 3] *= 0.92;
        pos[i * 3 + 1] *= 0.92;
        pos[i * 3 + 2] *= 0.92;
      }
      pointsRef.current.rotation.y += delta * 0.5;

      if (timeRef.current > 1.5) {
        timeRef.current = 0;
        onPhaseChange("done");
      }
    } else if (phaseRef.current === "done") {
      for (let i = 0; i < count; i++) {
        pos[i * 3] *= 0.99;
        pos[i * 3 + 1] *= 0.99;
        pos[i * 3 + 2] *= 0.99;
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={phase === "done" ? 0.3 : 0.9}
        sizeAttenuation
      />
    </points>
  );
}

function NameText({ name, visible }: { name: string; visible: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current && visible) {
      meshRef.current.rotation.y += delta * 0.3;
    }
  });

  if (!visible || !name) return null;

  return (
    <group ref={meshRef}>
      <Text
        fontSize={0.8}
        color="#c084fc"
        anchorX="center"
        anchorY="middle"
        font={undefined}
        outlineWidth={0.02}
        outlineColor="#7c3aed"
      >
        {name}
      </Text>
      {/* Glow ring */}
      <mesh>
        <torusGeometry args={[1.5, 0.03, 8, 64]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[1.8, 0.02, 8, 64]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function CameraController({ phase }: { phase: string }) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (phase === "spinning") {
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, 6, delta * 2);
    } else if (phase === "done") {
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, 5, delta * 1);
    } else {
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, 8, delta * 1);
    }
    camera.lookAt(0, 0, 0);
  });

  return null;
}

interface RollCallSceneProps {
  students: Student[];
  onSelect: (student: Student) => void;
}

export default function RollCallScene({ students, onSelect }: RollCallSceneProps) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "revealing" | "done">("idle");
  const [selected, setSelected] = useState<Student | null>(null);
  const [remaining, setRemaining] = useState<Student[]>(students);

  function handleStart() {
    if (remaining.length === 0) return;
    const idx = Math.floor(Math.random() * remaining.length);
    const picked = remaining[idx];
    setSelected(picked);
    setPhase("spinning");
  }

  function handleReset() {
    setPhase("idle");
    setSelected(null);
    setRemaining(students);
  }

  function handlePhaseChange(newPhase: "idle" | "spinning" | "revealing" | "done") {
    setPhase(newPhase);
    if (newPhase === "done" && selected) {
      onSelect(selected);
      setRemaining((prev) => prev.filter((s) => s.id !== selected.id));
    }
  }

  return (
    <div className="relative w-full h-full">
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }} gl={{ antialias: true }}>
        <color attach="background" args={["#0a0a1a"]} />
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#c084fc" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#818cf8" />

        <Stars radius={50} depth={50} count={3000} factor={2} fade speed={1} />

        <ParticleField
          students={students}
          phase={phase}
          selectedName={selected?.name ?? ""}
          onPhaseChange={handlePhaseChange}
        />

        <NameText name={selected?.name ?? ""} visible={phase === "done"} />
        <CameraController phase={phase} />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-end pb-8">
        {/* Status info */}
        {phase === "idle" && (
          <div className="pointer-events-auto text-center">
            <p className="text-slate-400 text-sm mb-4">
              剩余 <span className="text-purple-300 font-bold">{remaining.length}</span> 人待点名
            </p>
            <button
              onClick={handleStart}
              disabled={remaining.length === 0}
              className="px-10 py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-lg font-bold rounded-2xl shadow-lg shadow-purple-900/50 transition transform hover:scale-105 active:scale-95"
            >
              {remaining.length === 0 ? "全部完成 🎉" : "开始抽取 🎲"}
            </button>
          </div>
        )}

        {phase === "spinning" && (
          <div className="text-center">
            <p className="text-purple-300 text-xl font-bold animate-pulse">抽取中...</p>
          </div>
        )}

        {phase === "done" && selected && (
          <div className="pointer-events-auto text-center space-y-3">
            <div className="bg-slate-900/80 backdrop-blur-sm border border-purple-500/30 rounded-2xl px-8 py-4">
              <p className="text-slate-400 text-sm">被点到的同学</p>
              <p className="text-white text-3xl font-bold mt-1">{selected.name}</p>
              {selected.studentId && (
                <p className="text-slate-500 text-sm mt-0.5">{selected.studentId}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleStart}
                disabled={remaining.length === 0}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium rounded-xl transition"
              >
                再抽一个
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
              >
                重置名单
              </button>
            </div>
            {remaining.length === 0 && (
              <p className="text-green-400 text-sm">🎉 所有学生已点完！</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
