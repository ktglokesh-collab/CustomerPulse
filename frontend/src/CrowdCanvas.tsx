import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

type CrowdCanvasProps = {
  src?: string
  rows?: number
  cols?: number
}

type Peep = {
  image: HTMLImageElement
  rect: number[]
  width: number
  height: number
  drawArgs: unknown[]
  x: number
  y: number
  anchorY: number
  scaleX: number
  walk?: gsap.core.Timeline
  setRect: (rect: number[]) => void
  render: (ctx: CanvasRenderingContext2D) => void
}

export function CrowdCanvas({ src = '/images/peeps/all-peeps.png', rows = 15, cols = 7 }: CrowdCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const canvasEl = canvas
    const context = ctx

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const randomRange = (min: number, max: number) => min + Math.random() * (max - min)
    const randomIndex = <T,>(array: T[]) => randomRange(0, array.length) | 0
    const removeFromArray = <T,>(array: T[], index: number) => array.splice(index, 1)[0]
    const removeItemFromArray = <T,>(array: T[], item: T) => removeFromArray(array, array.indexOf(item))
    const removeRandomFromArray = <T,>(array: T[]) => removeFromArray(array, randomIndex(array))
    const getRandomFromArray = <T,>(array: T[]) => array[randomIndex(array)]

    const img = document.createElement('img')
    const stage = { width: 0, height: 0 }
    const allPeeps: Peep[] = []
    const availablePeeps: Peep[] = []
    const crowd: Peep[] = []

    function createPeep({ image, rect }: { image: HTMLImageElement; rect: number[] }): Peep {
      const peep: Peep = {
        image,
        rect: [],
        width: 0,
        height: 0,
        drawArgs: [],
        x: 0,
        y: 0,
        anchorY: 0,
        scaleX: 1,
        setRect(nextRect: number[]) {
          peep.rect = nextRect
          peep.width = nextRect[2]
          peep.height = nextRect[3]
          peep.drawArgs = [peep.image, ...nextRect, 0, 0, peep.width, peep.height]
        },
        render(context: CanvasRenderingContext2D) {
          context.save()
          context.translate(peep.x, peep.y)
          context.scale(peep.scaleX, 1)
          context.drawImage(
            peep.image,
            peep.rect[0],
            peep.rect[1],
            peep.rect[2],
            peep.rect[3],
            0,
            0,
            peep.width,
            peep.height,
          )
          context.restore()
        },
      }

      peep.setRect(rect)
      return peep
    }

    function resetPeep(peep: Peep) {
      const direction = Math.random() > 0.5 ? 1 : -1
      const offsetY = 100 - 250 * gsap.parseEase('power2.in')(Math.random())
      const startY = stage.height - peep.height + offsetY
      const startX = direction === 1 ? -peep.width : stage.width + peep.width
      const endX = direction === 1 ? stage.width : 0

      peep.scaleX = direction
      peep.x = startX
      peep.y = startY
      peep.anchorY = startY

      return { startY, endX }
    }

    function normalWalk({ peep, props }: { peep: Peep; props: ReturnType<typeof resetPeep> }) {
      const xDuration = 10
      const yDuration = 0.25
      const timeline = gsap.timeline()

      timeline.timeScale(randomRange(0.5, 1.5))
      timeline.to(peep, { duration: xDuration, x: props.endX, ease: 'none' }, 0)
      timeline.to(peep, { duration: yDuration, repeat: xDuration / yDuration, yoyo: true, y: props.startY - 10 }, 0)

      return timeline
    }

    const walks = [normalWalk]

    function createPeeps() {
      const rectWidth = img.naturalWidth / rows
      const rectHeight = img.naturalHeight / cols

      for (let i = 0; i < rows * cols; i += 1) {
        allPeeps.push(
          createPeep({
            image: img,
            rect: [(i % rows) * rectWidth, ((i / rows) | 0) * rectHeight, rectWidth, rectHeight],
          }),
        )
      }
    }

    function removePeepFromCrowd(peep: Peep) {
      removeItemFromArray(crowd, peep)
      availablePeeps.push(peep)
    }

    function addPeepToCrowd() {
      const peep = removeRandomFromArray(availablePeeps)
      const walk = getRandomFromArray(walks)({ peep, props: resetPeep(peep) }).eventCallback('onComplete', () => {
        removePeepFromCrowd(peep)
        addPeepToCrowd()
      })

      peep.walk = walk
      crowd.push(peep)
      crowd.sort((a, b) => a.anchorY - b.anchorY)

      return peep
    }

    function initCrowd() {
      while (availablePeeps.length) {
        addPeepToCrowd().walk?.progress(Math.random())
      }
    }

    function render() {
      context.clearRect(0, 0, canvasEl.width, canvasEl.height)
      context.save()
      context.scale(dpr, dpr)
      crowd.forEach((peep) => peep.render(context))
      context.restore()
    }

    function resize() {
      stage.width = canvasEl.clientWidth
      stage.height = canvasEl.clientHeight
      canvasEl.width = Math.floor(stage.width * dpr)
      canvasEl.height = Math.floor(stage.height * dpr)

      crowd.forEach((peep) => peep.walk?.kill())
      crowd.length = 0
      availablePeeps.length = 0
      availablePeeps.push(...allPeeps)
      initCrowd()
    }

    function init() {
      createPeeps()
      resize()
      gsap.ticker.add(render)
    }

    img.onload = init
    img.src = src
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      gsap.ticker.remove(render)
      crowd.forEach((peep) => peep.walk?.kill())
    }
  }, [cols, rows, src])

  return <canvas ref={canvasRef} className="crowd-canvas" aria-label="Animated crowd canvas" />
}
