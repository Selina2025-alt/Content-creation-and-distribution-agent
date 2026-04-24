import { CreateTaskHero } from "@/components/home/create-task-hero";

export default function HomePage() {
  return (
    <main className="home-page">
      <div className="home-page__backdrop" />
      <section className="home-page__intro">
        <p className="eyebrow">Content Factory</p>
        <h1>
          <span>What should we</span>
          <span>create today?</span>
        </h1>
        <p className="home-page__description">
          一个需求，同时生成适配公众号、小红书、Twitter 和视频脚本的多平台内容。
        </p>
      </section>

      <CreateTaskHero />
    </main>
  );
}
