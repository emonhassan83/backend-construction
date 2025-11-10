import { USER_ROLE } from '../user/user.constant'
import { User } from '../user/user.model'
import { startOfYear, endOfYear } from 'date-fns'
import { WorkPhoto } from '../workPhotos/workPhotos.model'
import mongoose from 'mongoose'

const fetchCombinedMetaData = async (user: any, query: Record<string, unknown>) => {
  switch (user?.role) {
    case USER_ROLE.admin:
      return await getAdminMetaData(query)
    case USER_ROLE.project_manager:
      return await getCompanyMetaData(query, user)
    default:
      throw new Error('Unauthorized role for dashboard meta access!')
  }
}

// 🟦 ADMIN META
const getAdminMetaData = async (query: Record<string, unknown>) => {
  const totalCompanyCount = await User.countDocuments({
    role: USER_ROLE.project_manager,
    isDeleted: false,
  })

  const totalUserCount = await User.countDocuments({ isDeleted: false })

  const now = new Date()
  const firstDayOfCurrentMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  )
  const lastDayOfCurrentMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  )

  const newRegisterCount = await User.countDocuments({
    createdAt: { $gte: firstDayOfCurrentMonth, $lte: lastDayOfCurrentMonth },
  })

  const selectedUserYear = query.year
    ? parseInt(query.year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  const userOverview = await getUserOverview(selectedUserYear)

  return {
    type: 'admin',
    totalCompanyCount,
    totalUserCount,
    newRegisterCount,
    userOverview,
  }
}

// 🟨 COMPANY META
const getCompanyMetaData = async (query: Record<string, unknown>, user: any) => {
  const totalWorkerCount = await User.countDocuments({
    role: USER_ROLE.worker,
    company: user._id,
    isDeleted: false,
  })

  const totalImageCount = await WorkPhoto.countDocuments({
    company: user._id,
    isDeleted: false,
  })

  const selectedUserYear = query.year
    ? parseInt(query.year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  const userOverview = await getCompanyUserOverview(selectedUserYear, user)

  return {
    type: 'company',
    totalWorkerCount,
    totalImageCount,
    userOverview,
  }
}

// 📊 Helper: Company Overview
const getCompanyUserOverview = async (year: number, user: any) => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const isCurrentYear = year === currentYear

  const yearStart = startOfYear(new Date(year, 0, 1))
  const yearEnd = endOfYear(new Date(year, 11, 31))

  const monthlyUsers = await User.aggregate([
    {
      $match: {
        company: new mongoose.Types.ObjectId(user._id),
        role: USER_ROLE.worker,
        createdAt: { $gte: yearStart, $lte: yearEnd },
      },
    },
    { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])

  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ]

  const filteredMonths = isCurrentYear
    ? months.slice(0, now.getMonth() + 1)
    : months

  return filteredMonths.map((month, i) => ({
    month,
    count: monthlyUsers.find((m: any) => m._id === i + 1)?.count || 0,
  }))
}

// 📈 Helper: Admin Overview
const getUserOverview = async (year: number) => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const isCurrentYear = year === currentYear

  const yearStart = startOfYear(new Date(year, 0, 1))
  const yearEnd = endOfYear(new Date(year, 11, 31))

  const monthlyUsers = await User.aggregate([
    { $match: { createdAt: { $gte: yearStart, $lte: yearEnd } } },
    { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])

  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ]

  const filteredMonths = isCurrentYear
    ? months.slice(0, now.getMonth() + 1)
    : months

  return filteredMonths.map((month, i) => ({
    month,
    count: monthlyUsers.find((m: any) => m._id === i + 1)?.count || 0,
  }))
}

export const MetaService = { fetchCombinedMetaData }
