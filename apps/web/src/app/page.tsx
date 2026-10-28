import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Voxilizer · early build</p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Design your vocal tone before you sing it.</h1>
      <p className="max-w-prose text-lg text-zinc-600 dark:text-zinc-400">
        Write your vocal line, choose the grit, growl and twang for every note, and hear it without spending your voice.
        Then train toward it, one healthy stage at a time.
      </p>
      <div>
        <Link href="/studio" className="inline-block rounded-md bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-500">
          Open the studio
        </Link>
      </div>
    </main>
  );
}
