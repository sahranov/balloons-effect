import { BalloonEffect } from "./BalloonEffect";

export default function Home() {
  return (
    <main className="demo">
      <section className="screen" aria-label="Демонстрация эффекта на белом фоне">
        <img
          className="corner-bubble"
          src="/assets/corner-bubble.png"
          alt=""
          aria-hidden="true"
        />
        <BalloonEffect />
        <p className="sr-only">
          Нажмите на экран или клавишу R, чтобы запустить эффект.
        </p>
      </section>
    </main>
  );
}
