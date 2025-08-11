import { USER_ROLE } from '../user/user.constant'
import { User } from '../user/user.model'
import { startOfYear, endOfYear } from 'date-fns'

const fetchDashboardMetaData = async (
  user: any,
  query: Record<string, unknown>,
) => {
  if (user?.role !== USER_ROLE.admin) {
    throw new Error('Invalid user role!')
  }
  return await getAdminMetaData(query)
}

const fetchCompanyDashboardMetaData = async (
  user: any,
  query: Record<string, unknown>,
) => {
  if (user?.role !== USER_ROLE.project_manager) {
    throw new Error('Invalid user role!')
  }
  return await getCompanyMetaData(query, user)
}

const getAdminMetaData = async (query: Record<string, unknown>) => {
  const totalCompanyCount = await User.countDocuments({
    role: USER_ROLE.project_manager,
    isDeleted: false,
  })
  const totalUserCount = await User.countDocuments({
    role: USER_ROLE.worker,
    isDeleted: false,
  })
  const { user_year } = query

  const now = new Date()
  const firstDayOfCurrentMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  )
  const lastDayOfCurrentMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  )

  // New registered users in the current month
  const newRegisterCount = await User.countDocuments({
    createdAt: { $gte: firstDayOfCurrentMonth, $lte: lastDayOfCurrentMonth },
  })

  const selectedUserYear = user_year
    ? parseInt(user_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  // Fetch user registration overview based on the selected year
  const userOverview = await getUserOverview(selectedUserYear)

  return {
    totalCompanyCount,
    totalUserCount,
    newRegisterCount,
    userOverview,
  }
}

const getCompanyMetaData = async (query: Record<string, unknown>, user: any) => {
  const totalWorkerCount = await User.countDocuments({
    role: USER_ROLE.worker,
    company: user._id,
    isDeleted: false,
  })
  const totalImageCount = await User.countDocuments({
    company: user._id,
    isDeleted: false,
  })
  const { user_year } = query
  const selectedUserYear = user_year
    ? parseInt(user_year as string, 10) || new Date().getFullYear()
    : new Date().getFullYear()

  // Fetch user registration overview based on the selected year
  const userOverview = await getCompanyUserOverview(selectedUserYear, user)

  return {
    totalWorkerCount,
    totalImageCount,
    userOverview,
  }
}

const getCompanyUserOverview = async (year: number, user: any) => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const isCurrentYear = year === currentYear

  const yearStart = startOfYear(new Date(year, 0, 1))
  const yearEnd = endOfYear(new Date(year, 11, 31))

  // Aggregate Monthly User Registrations
  const monthlyUsers = await User.aggregate([
    {
      $match: {
        company: user._id,
        createdAt: { $gte: yearStart, $lte: yearEnd },
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const filteredMonths = isCurrentYear
    ? months.slice(0, now.getMonth() + 1)
    : months

  const userOverview = filteredMonths.map((month, index) => {
    const data = monthlyUsers.find((m: any) => m._id === index + 1)
    return { month, count: data ? data.count : 0 }
  })

  return userOverview
}

const getUserOverview = async (year: number) => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const isCurrentYear = year === currentYear

  const yearStart = startOfYear(new Date(year, 0, 1))
  const yearEnd = endOfYear(new Date(year, 11, 31))

  // Aggregate Monthly User Registrations
  const monthlyUsers = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: yearStart, $lte: yearEnd },
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const filteredMonths = isCurrentYear
    ? months.slice(0, now.getMonth() + 1)
    : months

  const userOverview = filteredMonths.map((month, index) => {
    const data = monthlyUsers.find((m: any) => m._id === index + 1)
    return { month, count: data ? data.count : 0 }
  })

  return userOverview
}

export const MetaService = {
  fetchDashboardMetaData,
  fetchCompanyDashboardMetaData,
}
