import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { MetaService } from './meta.service'

const fetchDashboardMetaData = catchAsync(async (req, res) => {
  const result = await MetaService.fetchCombinedMetaData(req.user, req.query)

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Dashboard meta data retrieved successfully!',
    data: result,
  })
})

export const MetaController = {
  fetchDashboardMetaData,
}
