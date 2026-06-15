<script setup lang="ts">
interface Props {
  h?: number
  size?: number
  colorA?: string
  colorB?: string
}
const props = withDefaults(defineProps<Props>(), {
  h: 16,
  size: 28,
  colorA: '#121212',
  colorB: '#EFE7D6',
})
</script>

<template>
  <div
    :style="{
      height: `${props.h}px`,
      width: '100%',
      backgroundImage: `repeating-conic-gradient(${props.colorA} 0% 25%, ${props.colorB} 0% 50%)`,
      backgroundSize: `${props.size}px ${props.h}px`,
      backgroundPosition: '0 0',
      flexShrink: 0,
    }"
  />
</template>
