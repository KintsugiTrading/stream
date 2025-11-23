import Scene from '@/components/Scene';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <Scene />

      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h1 className="text-4xl font-bold text-white drop-shadow-md">Stream Trailer Simulator</h1>
        <p className="text-white/80 text-lg drop-shadow-md">Interactive Hydrology Model</p>
      </div>

      <div className="absolute bottom-4 left-4 z-10 pointer-events-none max-w-md">
        <p className="text-white/60 text-sm drop-shadow-md">
          Use the controls on the right to adjust slope and simulation parameters.
          Left click to rotate, Right click to pan, Scroll to zoom.
        </p>
      </div>
    </main>
  );
}
