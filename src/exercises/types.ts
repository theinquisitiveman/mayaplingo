import type { Exercise } from '../lib/exercises'

export interface ExerciseProps<E extends Exercise = Exercise> {
  ex: E
  value: string
  setValue: (v: string) => void
  locked: boolean // answer checked; inputs frozen
  onFix: (itemId: string) => void
}
