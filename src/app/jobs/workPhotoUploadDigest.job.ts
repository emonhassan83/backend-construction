import { sendPendingWorkPhotoUploadDigests } from '../modules/workPhotos/uploadNotification/workPhotoUploadNotification.utils'

const SWISS_TIMEZONE = 'Europe/Zurich'
const WORKING_DAY_START_HOUR = 8
const WORKING_DAY_END_HOUR = 17
const WORKING_DAY_END_MINUTE = 30
const DAILY_DIGEST_RUNS = 3

let currentDigestScheduleDateKey = ''
let currentDigestScheduleMinuteOffsets = new Set<number>()

const getSwissDateTimeParts = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SWISS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value)

  return {
    dateKey: `${value('year')}-${String(value('month')).padStart(2, '0')}-${String(value('day')).padStart(2, '0')}`,
    hour: value('hour'),
    minute: value('minute'),
  }
}

const buildRandomDigestMinuteOffsets = (minMinuteOffset = 0) => {
  const workingMinutes =
    (WORKING_DAY_END_HOUR - WORKING_DAY_START_HOUR) * 60 +
    WORKING_DAY_END_MINUTE
  const startMinuteOffset = Math.min(minMinuteOffset, workingMinutes)
  const availableMinutes = workingMinutes - startMinuteOffset
  const runCount = Math.min(DAILY_DIGEST_RUNS, availableMinutes + 1)

  const selectedMinutes = new Set<number>()
  while (selectedMinutes.size < runCount) {
    selectedMinutes.add(
      startMinuteOffset + Math.floor(Math.random() * (availableMinutes + 1)),
    )
  }

  return selectedMinutes
}

const getTodayDigestScheduleMinuteOffsets = () => {
  const { dateKey, hour, minute } = getSwissDateTimeParts()

  if (currentDigestScheduleDateKey !== dateKey) {
    currentDigestScheduleDateKey = dateKey
    currentDigestScheduleMinuteOffsets = buildRandomDigestMinuteOffsets(
      Math.max(0, (hour - WORKING_DAY_START_HOUR) * 60 + minute),
    )

    const labels = Array.from(currentDigestScheduleMinuteOffsets)
      .sort((a, b) => a - b)
      .map((minuteOffset) => {
        const hour = WORKING_DAY_START_HOUR + Math.floor(minuteOffset / 60)
        const minute = minuteOffset % 60

        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      })

    console.log(
      `[WORK_PHOTO_DIGEST] Today's random Swiss digest times: ${labels.join(', ')} (${SWISS_TIMEZONE}).`,
    )
  }

  return currentDigestScheduleMinuteOffsets
}

export const shouldRunWorkPhotoUploadDigestJob = () => {
  const { hour, minute } = getSwissDateTimeParts()
  const minuteOffset = (hour - WORKING_DAY_START_HOUR) * 60 + minute
  const maxMinuteOffset =
    (WORKING_DAY_END_HOUR - WORKING_DAY_START_HOUR) * 60 +
    WORKING_DAY_END_MINUTE

  if (minuteOffset < 0 || minuteOffset > maxMinuteOffset) return false

  return getTodayDigestScheduleMinuteOffsets().has(minuteOffset)
}

export const workPhotoUploadDigestJob = async () => {
  console.log('[WORK_PHOTO_DIGEST] Starting pending work photo digest job...')
  await sendPendingWorkPhotoUploadDigests()
  console.log('[WORK_PHOTO_DIGEST] Pending work photo digest job completed.')
}
