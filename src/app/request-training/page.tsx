import { RequestTrainingForm } from "@/components/RequestTrainingForm";

export default function RequestTrainingPage() {
  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-[0.75fr_1.25fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">
            Request Training
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Start a private training conversation.
          </h1>
          <p className="mt-4 leading-7 text-slate-700">
            Send a short inquiry with the player&apos;s age, goals, location, and availability. Training
            details are discussed after the request is submitted.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <RequestTrainingForm />
        </div>
      </div>
    </main>
  );
}
