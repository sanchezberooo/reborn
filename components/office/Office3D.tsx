'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CameraControls, Grid, Html } from '@react-three/drei'
import * as THREE from 'three'

// ─── types ────────────────────────────────────────────────────────────────────

export interface Agent3D {
  id: string
  name: string
  icon: string
  color: string
  status: 'active' | 'idle' | 'stopped'
  module: string
  lastActivity?: string
  description?: string
}

// ─── layout ───────────────────────────────────────────────────────────────────
// Horseshoe around center hub. Front is +Z (toward camera), back is -Z.
// Left group: -X side  |  Right group: +X side  |  Back group: -Z
//
//                    [SANCHEZ HUB @ 0,0,0]
//
//  Left front  (-4.5, 5.5)    Right front  (4.5, 5.5)
//  Left mid    (-6.5, 1.0)    Right mid    (6.5, 1.0)
//  Left back   (-5.5,-3.5)    Right back   (5.5,-3.5)
//  Back-L (-2.5,-7.0)  Back-C (0,-8.0)  Back-R (2.5,-7.0)

export const OFFICE_LAYOUT: Array<{ id: string; position: [number, number, number] }> = [
  { id: 'scholarship', position: [-4.5, 0,  5.5] }, // left front
  { id: 'ielts',       position: [-6.5, 0,  1.0] }, // left mid
  { id: 'routine',     position: [-5.5, 0, -3.5] }, // left back
  { id: 'finance',     position: [ 4.5, 0,  5.5] }, // right front
  { id: 'discover',    position: [ 6.5, 0,  1.0] }, // right mid
  { id: 'secretary',   position: [ 5.5, 0, -3.5] }, // right back
  { id: 'content',     position: [-2.5, 0, -7.0] }, // back left
  { id: '__empty1__',  position: [ 0.0, 0, -8.0] }, // back center
  { id: '__empty2__',  position: [ 2.5, 0, -7.0] }, // back right
]

const GOLD = '#c8a96e'

// Room opening faces center — compute Y rotation for each room
function roomAngle(px: number, pz: number): number {
  return Math.atan2(-px, -pz)
}

// ─── office screen ────────────────────────────────────────────────────────────

function OfficeScreen({ active, color }: { active: boolean; color: string }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const c = useMemo(() => new THREE.Color(color), [color])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.emissiveIntensity = active
      ? 0.42 + Math.sin(clock.getElapsedTime() * 2.1) * 0.1
      : 0.03
  })

  return (
    <mesh position={[0, 0.72, -0.68]} rotation={[-0.15, 0, 0]}>
      <boxGeometry args={[0.71, 0.44, 0.02]} />
      <meshStandardMaterial
        ref={matRef}
        color={active ? '#080605' : '#040404'}
        emissive={c}
        emissiveIntensity={0.42}
        roughness={0.1}
        metalness={0.3}
      />
    </mesh>
  )
}

// ─── empty slot ───────────────────────────────────────────────────────────────

function EmptySlot({ position }: { position: [number, number, number] }) {
  const angle = roomAngle(position[0], position[2])

  return (
    <group position={position} rotation={[0, angle, 0]}>
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[2.4, 0.03, 2.4]} />
        <meshStandardMaterial color="#060606" roughness={1} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, 1.0, -1.2]}>
        <boxGeometry args={[2.4, 2.0, 0.07]} />
        <meshStandardMaterial color="#060606" roughness={1} />
      </mesh>
      {/* side walls */}
      {([-1.2, 1.2] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 1.0, 0]}>
          <boxGeometry args={[0.07, 2.0, 2.4]} />
          <meshStandardMaterial color="#060606" roughness={1} />
        </mesh>
      ))}
      <Html position={[0, 2.2, 1.1]} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
        <span style={{
          fontSize: 7, color: '#181e28', fontFamily: 'system-ui',
          letterSpacing: '0.12em', fontWeight: 700, userSelect: 'none',
          textTransform: 'uppercase',
        }}>
          YAKINDA
        </span>
      </Html>
    </group>
  )
}

// ─── agent room ───────────────────────────────────────────────────────────────

function AgentRoom({
  agent, position, selected, onClick,
}: {
  agent: Agent3D
  position: [number, number, number]
  selected: boolean
  onClick: () => void
}) {
  const angle = roomAngle(position[0], position[2])
  const active  = agent.status === 'active'
  const stopped = agent.status === 'stopped'
  const accent  = active ? agent.color : stopped ? '#3a1515' : '#141e28'
  const c       = useMemo(() => new THREE.Color(accent), [accent])
  const accentC = useMemo(
    () => new THREE.Color(active ? agent.color : stopped ? '#3a1515' : '#1a2535'),
    [active, stopped, agent.color],
  )

  const groupRef = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!groupRef.current) return
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y, selected ? 0.09 : 0, 0.09,
    )
  })

  const wallMat = { color: '#0b0b0b', roughness: 0.95 } as const
  const legPositions: [number, number][] = [[-0.58, -0.3], [0.58, -0.3], [-0.58, 0.32], [0.58, 0.32]]

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, angle, 0]}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      {/* floor plate */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[2.4, 0.04, 2.4]} />
        <meshStandardMaterial color={active ? '#0e0c08' : '#080808'} roughness={0.95} />
      </mesh>

      {/* front threshold strip */}
      <mesh position={[0, 0.03, 1.18]}>
        <boxGeometry args={[2.4, 0.018, 0.025]} />
        <meshStandardMaterial color={accent} emissive={accentC}
          emissiveIntensity={active ? 0.85 : 0.12} roughness={0.2} />
      </mesh>

      {/* back wall */}
      <mesh position={[0, 1.1, -1.2]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 2.2, 0.07]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>

      {/* left wall */}
      <mesh position={[-1.2, 1.1, 0]} castShadow>
        <boxGeometry args={[0.07, 2.2, 2.4]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.95} />
      </mesh>

      {/* right wall */}
      <mesh position={[1.2, 1.1, 0]} castShadow>
        <boxGeometry args={[0.07, 2.2, 2.4]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.95} />
      </mesh>

      {/* door frame — top beam */}
      <mesh position={[0, 2.2, 1.2]}>
        <boxGeometry args={[1.1, 0.07, 0.07]} />
        <meshStandardMaterial color={accent} emissive={accentC}
          emissiveIntensity={active ? 0.9 : 0.1} roughness={0.2} />
      </mesh>

      {/* door frame — left post */}
      <mesh position={[-0.55, 1.1, 1.2]}>
        <boxGeometry args={[0.055, 2.2, 0.055]} />
        <meshStandardMaterial color={accent} emissive={accentC}
          emissiveIntensity={active ? 0.55 : 0.08} roughness={0.3} />
      </mesh>

      {/* door frame — right post */}
      <mesh position={[0.55, 1.1, 1.2]}>
        <boxGeometry args={[0.055, 2.2, 0.055]} />
        <meshStandardMaterial color={accent} emissive={accentC}
          emissiveIntensity={active ? 0.55 : 0.08} roughness={0.3} />
      </mesh>

      {/* desk top */}
      <mesh position={[0, 0.42, -0.38]} castShadow>
        <boxGeometry args={[1.3, 0.05, 0.75]} />
        <meshStandardMaterial color="#141414" roughness={0.7} metalness={0.45} />
      </mesh>

      {/* desk legs */}
      {legPositions.map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.19, -0.38 + lz]}>
          <boxGeometry args={[0.035, 0.42, 0.035]} />
          <meshStandardMaterial color="#0c0c0c" roughness={0.8} />
        </mesh>
      ))}

      {/* monitor stand */}
      <mesh position={[0, 0.5, -0.65]}>
        <boxGeometry args={[0.04, 0.14, 0.04]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.5} />
      </mesh>

      {/* monitor bezel */}
      <mesh position={[0, 0.72, -0.68]} rotation={[-0.15, 0, 0]}>
        <boxGeometry args={[0.75, 0.48, 0.025]} />
        <meshStandardMaterial color="#090909" roughness={0.5} metalness={0.6} />
      </mesh>

      <OfficeScreen active={active} color={accent} />

      {/* keyboard */}
      <mesh position={[0, 0.455, -0.12]}>
        <boxGeometry args={[0.52, 0.01, 0.17]} />
        <meshStandardMaterial color="#111" roughness={0.9} />
      </mesh>

      {/* desk front accent */}
      <mesh position={[0, 0.435, 0.04]}>
        <boxGeometry args={[1.3, 0.008, 0.008]} />
        <meshStandardMaterial color={accent} emissive={c}
          emissiveIntensity={active ? 1.1 : 0.12} roughness={0.2} />
      </mesh>

      {/* active ceiling spot */}
      {active && (
        <pointLight position={[0, 2.1, -0.3]} color={agent.color}
          intensity={1.5} distance={3.5} decay={2} castShadow />
      )}

      {/* selection ring */}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
          <ringGeometry args={[1.0, 1.08, 36]} />
          <meshStandardMaterial color={accent} emissive={c} emissiveIntensity={1.7}
            transparent opacity={0.65} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* nameplate above door */}
      <Html position={[0, 2.55, 1.1]} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, userSelect: 'none' }}>
          <span style={{ fontSize: 13, lineHeight: 1 }}>{agent.icon}</span>
          <span style={{
            fontSize: 7, fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', whiteSpace: 'nowrap',
            color: active ? GOLD : '#242e3c',
            fontFamily: 'system-ui, sans-serif',
          }}>
            {agent.name}
          </span>
        </div>
      </Html>
    </group>
  )
}

// ─── Sanchez hub ─────────────────────────────────────────────────────────────

function SanchezHub({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  const ring1 = useRef<THREE.Mesh>(null)
  const ring2 = useRef<THREE.Mesh>(null)
  const ring3 = useRef<THREE.Mesh>(null)
  const pillar = useRef<THREE.Mesh>(null)
  const sphere = useRef<THREE.MeshStandardMaterial>(null)
  const c = useMemo(() => new THREE.Color(GOLD), [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (ring1.current) ring1.current.rotation.z = t * 0.55
    if (ring2.current) ring2.current.rotation.z = -t * 0.75
    if (ring3.current) ring3.current.rotation.x = t * 0.35
    if (sphere.current) sphere.current.emissiveIntensity = 0.5 + Math.sin(t * 1.8) * 0.2
    if (pillar.current) {
      const s = 1 + Math.sin(t * 2.2) * 0.04
      pillar.current.scale.set(s, 1, s)
    }
  })

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick() }}>

      {/* ground glow fill */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <circleGeometry args={[2.5, 64]} />
        <meshStandardMaterial color={GOLD} emissive={c} emissiveIntensity={0.1}
          transparent opacity={0.14} side={THREE.DoubleSide} />
      </mesh>

      {/* outer floor ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[2.3, 2.55, 72]} />
        <meshStandardMaterial color={GOLD} emissive={c} emissiveIntensity={0.75}
          transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>

      {/* inner floor ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
        <ringGeometry args={[1.3, 1.45, 56]} />
        <meshStandardMaterial color={GOLD} emissive={c} emissiveIntensity={0.5}
          transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* light pillar */}
      <mesh ref={pillar} position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.035, 0.07, 3.0, 16, 1, true]} />
        <meshStandardMaterial color={GOLD} emissive={c} emissiveIntensity={1.2}
          transparent opacity={0.65} roughness={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* floating ring 1 */}
      <mesh ref={ring1} position={[0, 0.9, 0]}>
        <torusGeometry args={[0.55, 0.018, 8, 44]} />
        <meshStandardMaterial color={GOLD} emissive={c} emissiveIntensity={1.6} roughness={0.08} />
      </mesh>

      {/* floating ring 2 */}
      <mesh ref={ring2} position={[0, 1.75, 0]} rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[0.44, 0.014, 8, 36]} />
        <meshStandardMaterial color={GOLD} emissive={c} emissiveIntensity={1.4} roughness={0.08} />
      </mesh>

      {/* floating ring 3 */}
      <mesh ref={ring3} position={[0, 2.5, 0]} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[0.3, 0.011, 8, 28]} />
        <meshStandardMaterial color={GOLD} emissive={c} emissiveIntensity={1.3} roughness={0.08} />
      </mesh>

      {/* apex sphere */}
      <mesh position={[0, 3.05, 0]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial ref={sphere} color={GOLD} emissive={c}
          emissiveIntensity={0.6} roughness={0.1} metalness={0.8} />
      </mesh>

      {/* hub light */}
      <pointLight position={[0, 1.5, 0]} color={GOLD} intensity={2.2} distance={7} decay={2} />

      {/* selected outer ring */}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[2.7, 2.88, 56]} />
          <meshStandardMaterial color={GOLD} emissive={c} emissiveIntensity={2.2}
            transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* label */}
      <Html position={[0, 3.6, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, userSelect: 'none' }}>
          <span style={{ fontSize: 17, lineHeight: 1 }}>🧠</span>
          <span style={{
            fontSize: 8, fontWeight: 800, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: GOLD,
            fontFamily: 'system-ui, sans-serif',
          }}>
            SANCHEZ
          </span>
        </div>
      </Html>
    </group>
  )
}

// ─── environment ──────────────────────────────────────────────────────────────

function OfficeEnv() {
  return (
    <>
      <fog attach="fog" args={['#050505', 20, 38]} />

      {/* main floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#060606" roughness={1} metalness={0} />
      </mesh>

      {/* grid */}
      <Grid
        position={[0, 0.001, 0]}
        args={[60, 60]}
        cellSize={1}
        cellThickness={0.28}
        cellColor="#101010"
        sectionSize={5}
        sectionThickness={0.55}
        sectionColor="#c8a96e0d"
        fadeDistance={30}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* very dim ambient floor glow under offices */}
      <pointLight position={[-5, 0.3, 3]} color="#1a2535" intensity={0.5} distance={5} />
      <pointLight position={[ 5, 0.3, 3]} color="#1a2535" intensity={0.5} distance={5} />
    </>
  )
}

// ─── scene ────────────────────────────────────────────────────────────────────

function Scene({
  agents, selectedId, onSelect,
}: {
  agents: Agent3D[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const ctrlRef = useRef<CameraControls>(null)

  useEffect(() => {
    const ctrl = ctrlRef.current
    if (!ctrl) return

    if (!selectedId) {
      ctrl.setLookAt(0, 11, 16, 0, 0, 0, true)
      return
    }
    if (selectedId === '__sanchez__') {
      ctrl.setLookAt(0, 5.5, 5.5, 0, 1.2, 0, true)
      return
    }
    const layout = OFFICE_LAYOUT.find((o) => o.id === selectedId)
    if (!layout) return
    const [px, , pz] = layout.position
    // position camera between center and office, elevated
    ctrl.setLookAt(px * 0.42, 4.5, pz * 0.42 + 2.5, px * 0.22, 0.8, pz * 0.22, true)
  }, [selectedId])

  return (
    <>
      <color attach="background" args={['#050505']} />
      <ambientLight intensity={0.1} color="#fff8e8" />
      <directionalLight
        position={[3, 9, 6]} intensity={0.28} castShadow color="#fff4e0"
        shadow-mapSize={[1024, 1024]}
      />

      <OfficeEnv />

      <SanchezHub
        selected={selectedId === '__sanchez__'}
        onClick={() => onSelect(selectedId === '__sanchez__' ? null : '__sanchez__')}
      />

      {OFFICE_LAYOUT.map(({ id, position }) => {
        if (id.startsWith('__empty')) return <EmptySlot key={id} position={position} />
        const agent = agents.find((a) => a.id === id)
        if (!agent) return <EmptySlot key={id} position={position} />
        return (
          <AgentRoom
            key={id}
            agent={agent}
            position={position}
            selected={selectedId === id}
            onClick={() => onSelect(selectedId === id ? null : id)}
          />
        )
      })}

      <CameraControls
        ref={ctrlRef}
        minDistance={5}
        maxDistance={26}
        minPolarAngle={Math.PI / 9}
        maxPolarAngle={Math.PI / 2.15}
        makeDefault
      />
    </>
  )
}

// ─── export ───────────────────────────────────────────────────────────────────

export default function Office3D({
  agents, selectedId, onSelect,
}: {
  agents: Agent3D[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 11, 16], fov: 48 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%', background: '#050505' }}
      onPointerMissed={() => onSelect(null)}
    >
      <Scene agents={agents} selectedId={selectedId} onSelect={onSelect} />
    </Canvas>
  )
}
