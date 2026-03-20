import Image from "next/image";
import type { PageBlock, PageSpec } from "@audion/page-spec";
import { LayoutGrid, Shield, Sparkles, Star, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function IconFor({ name }: { name?: string }) {
  const c = "h-5 w-5 text-primary";
  switch (name) {
    case "shield":
      return <Shield className={c} />;
    case "zap":
      return <Zap className={c} />;
    case "layout":
      return <LayoutGrid className={c} />;
    case "star":
      return <Star className={c} />;
    default:
      return <Sparkles className={c} />;
  }
}

function HeroBlock({ block }: { block: Extract<PageBlock, { type: "hero" }> }) {
  const align = block.align ?? "left";
  return (
    <section className="relative w-full min-h-[380px] overflow-hidden bg-muted">
      {block.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          width={1920}
          height={1080}
        />
      ) : null}
      <div
        className={cn(
          "relative z-[2] flex min-h-[380px] flex-col justify-end gap-4 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-8 md:p-14",
          align === "center" && "items-center text-center",
          align === "right" && "items-end text-right"
        )}
      >
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white md:text-4xl">
          {block.title}
        </h1>
        {block.subtitle ? (
          <p className="max-w-2xl text-lg text-white/90">{block.subtitle}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {block.primaryCta ? (
            <Button variant="default" size="lg" asChild>
              <a href={block.primaryCta.href ?? "#"}>{block.primaryCta.label}</a>
            </Button>
          ) : null}
          {block.secondaryCta ? (
            <Button variant="outline" size="lg" className="border-white/40 bg-white/10 text-white" asChild>
              <a href={block.secondaryCta.href ?? "#"}>{block.secondaryCta.label}</a>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function FeatureGridBlock({ block }: { block: Extract<PageBlock, { type: "featureGrid" }> }) {
  const cols = block.columns ?? 3;
  return (
    <section className="border-b bg-background px-6 py-14 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        {block.heading ? <h2 className="text-2xl font-semibold tracking-tight">{block.heading}</h2> : null}
        <div
          className={cn(
            "grid gap-6",
            cols === 2 && "md:grid-cols-2",
            cols === 3 && "md:grid-cols-3",
            cols === 4 && "md:grid-cols-4"
          )}
        >
          {block.items.map((item, i) => (
            <Card key={i} className="flex flex-col gap-2">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <IconFor name={item.icon} />
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              {item.description ? (
                <CardContent>
                  <CardDescription>{item.description}</CardDescription>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBlock({ block }: { block: Extract<PageBlock, { type: "cta" }> }) {
  const muted = block.variant === "muted";
  return (
    <section className={cn("px-6 py-14 md:px-10", muted ? "bg-muted" : "bg-primary/10")}>
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{block.title}</h2>
          {block.description ? <p className="mt-2 text-muted-foreground">{block.description}</p> : null}
        </div>
        <Button size="lg" asChild>
          <a href={block.href ?? "#"}>{block.buttonLabel}</a>
        </Button>
      </div>
    </section>
  );
}

function FooterBlock({ block }: { block: Extract<PageBlock, { type: "footer" }> }) {
  return (
    <footer className="mt-auto border-t bg-card px-6 py-12 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:justify-between">
        <div>
          <p className="text-lg font-semibold">{block.brand}</p>
          {block.tagline ? <p className="text-sm text-muted-foreground">{block.tagline}</p> : null}
        </div>
        {block.columns?.length ? (
          <div className="flex flex-wrap gap-10">
            {block.columns.map((col, i) => (
              <div key={i} className="min-w-[140px]">
                <p className="mb-2 text-sm font-medium">{col.heading}</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {col.links.map((l, j) => (
                    <li key={j}>
                      <a href={l.href ?? "#"} className="hover:underline">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {block.legal ? <p className="mx-auto mt-10 max-w-6xl text-xs text-muted-foreground">{block.legal}</p> : null}
    </footer>
  );
}

function LogoStripBlock({ block }: { block: Extract<PageBlock, { type: "logoStrip" }> }) {
  return (
    <section className="border-b bg-muted/40 px-6 py-10 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {block.heading ? <p className="text-center text-sm font-medium text-muted-foreground">{block.heading}</p> : null}
        <div className="flex flex-wrap items-center justify-center gap-4">
          {block.labels.map((label, i) => (
            <Badge key={i} variant="outline" className="px-4 py-2 text-xs">
              {label}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialBlock({ block }: { block: Extract<PageBlock, { type: "testimonial" }> }) {
  return (
    <section className="px-6 py-14 md:px-10">
      <blockquote className="mx-auto max-w-3xl text-center">
        <p className="text-xl font-medium leading-relaxed md:text-2xl">&ldquo;{block.quote}&rdquo;</p>
        <footer className="mt-6 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{block.author}</span>
          {block.role ? ` · ${block.role}` : null}
        </footer>
      </blockquote>
    </section>
  );
}

function RichTextBlock({ block }: { block: Extract<PageBlock, { type: "richText" }> }) {
  return (
    <section className="px-6 py-12 md:px-10">
      <div className="mx-auto max-w-3xl space-y-4">
        {block.heading ? <h2 className="text-2xl font-semibold">{block.heading}</h2> : null}
        {block.paragraphs.map((p, i) => (
          <p key={i} className="leading-relaxed text-muted-foreground">
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}

function CardGridBlock({ block }: { block: Extract<PageBlock, { type: "cardGrid" }> }) {
  const cols = block.columns ?? 3;
  return (
    <section className="border-b bg-background px-6 py-14 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        {block.heading ? <h2 className="text-2xl font-semibold tracking-tight">{block.heading}</h2> : null}
        <div
          className={cn(
            "grid gap-6",
            cols === 2 && "md:grid-cols-2",
            cols === 3 && "md:grid-cols-3",
            cols === 4 && "md:grid-cols-4"
          )}
        >
          {block.items.map((item, i) => (
            <Card key={i} className="flex flex-col overflow-hidden">
              {item.imageUrl ? (
                <div className="relative aspect-video w-full bg-muted">
                  <Image src={item.imageUrl} alt="" fill className="object-cover" sizes="400px" unoptimized />
                </div>
              ) : null}
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
                {item.description ? <CardDescription>{item.description}</CardDescription> : null}
              </CardHeader>
              {item.ctaLabel ? (
                <CardContent>
                  <Button variant="outline" size="sm" asChild>
                    <a href="#">{item.ctaLabel}</a>
                  </Button>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Block({ block }: { block: PageBlock }) {
  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} />;
    case "featureGrid":
      return <FeatureGridBlock block={block} />;
    case "cta":
      return <CtaBlock block={block} />;
    case "footer":
      return <FooterBlock block={block} />;
    case "logoStrip":
      return <LogoStripBlock block={block} />;
    case "testimonial":
      return <TestimonialBlock block={block} />;
    case "richText":
      return <RichTextBlock block={block} />;
    case "cardGrid":
      return <CardGridBlock block={block} />;
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

export function PageSpecRenderer({ spec }: { spec: PageSpec }) {
  const brand = spec.brand;
  return (
    <main
      className="min-h-screen flex flex-col bg-background text-foreground"
      style={
        brand?.primaryHex
          ? ({
              ["--primary" as string]: brand.primaryHex,
            } as React.CSSProperties)
          : undefined
      }
    >
      <header className="border-b px-6 py-4 md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="text-sm font-semibold">{spec.title}</p>
          <Badge variant="secondary">PageSpec v{spec.version}</Badge>
        </div>
      </header>
      <Separator />
      {spec.blocks.map((block, i) => (
        <Block key={block.id ?? `b-${i}`} block={block} />
      ))}
    </main>
  );
}
