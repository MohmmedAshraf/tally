'use client'

import { Dialog } from '@base-ui/react/dialog'
import { AnimatePresence, motion } from 'motion/react'
import Image from 'next/image'
import { useState, type ReactNode } from 'react'
import { film } from '@/lib/film'
import { Reveal } from '../ui/reveal'

const frame = 'shadow-[0_0_0_1px_oklch(0.26_0.014_268),0_60px_120px_-40px_oklch(0.53_0.2_268/.45)]'

const overlap = 'clamp(88px, 26vw, 340px)'

export function Film(): ReactNode {
  const [open, setOpen] = useState(false)

  if (film.src === '') return null

  return (
    <section
      id="film"
      aria-label="Film"
      className="relative z-1 bg-night pb-30 text-night-ink"
      style={{ marginTop: `calc(-1 * ${overlap})`, paddingTop: `calc(${overlap} + 120px)` }}
    >
      <div className="mx-auto flex max-w-300 flex-col gap-10 px-4 sm:px-8">
        <Reveal>
          <h2 className="m-0 max-w-160 text-[clamp(34px,4.6vw,60px)] leading-[1.02] font-bold tracking-[-0.04em] text-balance">
            See Tally in action.
          </h2>
        </Reveal>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Reveal delay={160}>
            <Dialog.Trigger
              aria-label="Play the film"
              render={
                <motion.button
                  type="button"
                  layoutId="film-frame"
                  className={`group relative block aspect-video w-full cursor-pointer overflow-hidden rounded-[20px] border-0 bg-night-3 p-0 ${frame}`}
                />
              }
            >
              <Image
                src={film.poster}
                alt=""
                fill
                sizes="(min-width: 1200px) 1136px, 100vw"
                className="object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(to_top,oklch(0.115_0.012_268/.7),oklch(0.115_0.012_268/.05)_60%)]">
                <motion.span
                  className="flex size-24 items-center justify-center rounded-full bg-night-ink shadow-[0_20px_50px_-10px_oklch(0_0_0/.5)]"
                  initial={{ scale: 0.8, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.06 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                >
                  <span className="ml-1.5 size-0 border-y-[15px] border-l-[24px] border-y-transparent border-l-ink" />
                </motion.span>
              </span>
            </Dialog.Trigger>
          </Reveal>
          <AnimatePresence>
            {open && (
              <Dialog.Portal keepMounted>
                <Dialog.Backdrop
                  render={
                    <motion.div
                      className="fixed inset-0 z-100 bg-[oklch(0.115_0.012_268/.82)] backdrop-blur-sm"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  }
                />
                <Dialog.Viewport className="fixed inset-0 z-101 flex items-center justify-center">
                  <Dialog.Popup
                    aria-label="See Tally in action"
                    render={
                      <motion.div
                        layoutId="film-frame"
                        className={`aspect-video w-[min(1200px,92vw)] overflow-hidden rounded-[20px] bg-night-3 ${frame}`}
                        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                      />
                    }
                  >
                    <video
                      src={film.src}
                      poster={film.poster}
                      controls
                      autoPlay
                      playsInline
                      className="block size-full object-cover"
                    >
                      <track
                        kind="captions"
                        src={film.captions}
                        srcLang="en"
                        label="English"
                      />
                    </video>
                  </Dialog.Popup>
                </Dialog.Viewport>
              </Dialog.Portal>
            )}
          </AnimatePresence>
        </Dialog.Root>
      </div>
    </section>
  )
}
