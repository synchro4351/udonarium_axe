<script setup lang="ts">
import { withBase } from 'vitepress';

/** The four steps of the beginner page, each a jump to its own section. */
const steps = [
  { no: 1, label: '部屋に入る', href: '#join' },
  { no: 2, label: 'コマを用意する', href: '#piece' },
  { no: 3, label: '話す', href: '#talk' },
  { no: 4, label: '判定する', href: '#roll' },
];
</script>

<template>
  <section class="intro-hero">
    <img class="intro-hero__chara" :src="withBase('/images/intro/kotoha-smile.webp')" alt="" aria-hidden="true" />
    <div class="intro-hero__body">
      <p class="intro-hero__eyebrow">クトゥルフ神話TRPG・PL向け</p>
      <p class="intro-hero__lead">
        覚えるのは、この4つだけ。<br />
        招待リンクをもらってから、最初の判定を振るまでを1ページで案内します。
      </p>
      <ol class="intro-hero__steps">
        <li v-for="step in steps" :key="step.no">
          <a :href="step.href"
            ><span class="intro-hero__no">{{ step.no }}</span
            >{{ step.label }}</a
          >
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.intro-hero {
  display: flex;
  align-items: center;
  gap: 20px;
  margin: 24px 0 32px;
  padding: 20px 24px;
  border-radius: 16px;
  background:
    radial-gradient(circle at 12% 20%, rgb(139 124 246 / 0.18), transparent 60%),
    linear-gradient(135deg, var(--vp-c-bg-soft), var(--vp-c-bg-alt));
  border: 1px solid var(--vp-c-divider);
}

.intro-hero__chara {
  flex: 0 0 auto;
  width: 96px;
  height: auto;
}

.intro-hero__body {
  min-width: 0;
}

.intro-hero__eyebrow {
  margin: 0;
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.intro-hero__lead {
  margin: 6px 0 14px;
  font-size: 16px;
  line-height: 1.8;
}

.intro-hero__steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.intro-hero__steps li {
  margin: 0;
}

.intro-hero__steps a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition:
    border-color 0.25s,
    transform 0.25s;
}

.intro-hero__steps a:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-1px);
}

.intro-hero__no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
  font-size: 13px;
}

@media (max-width: 520px) {
  .intro-hero {
    flex-direction: column;
    text-align: center;
  }

  .intro-hero__steps {
    justify-content: center;
  }
}
</style>
