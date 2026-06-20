export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">Pantry Agent</h1>
        <p className="mt-2 text-gray-500">Waste-aware meal planning</p>
        <a
          href="/import"
          className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white"
        >
          Import a recipe
        </a>
      </div>
    </main>
  );
}
