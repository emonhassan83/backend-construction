import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TProject } from './project.interface'
import { Project } from './project.model'
import { User } from '../user/user.model'
import { WorkPhoto } from '../workPhotos/workPhotos.model'
import mongoose from 'mongoose'

const createProjectIntoDB = async (payload: TProject, userId: string) => {
  // Validate user
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  // assign author and company
  payload.author = user._id

  // Create with calculated values
  const project = await Project.create(payload)
  if (!project) {
    throw new AppError(httpStatus.CONFLICT, 'Project record not created!')
  }

  return project
}

const getAllProjectsFromDB = async (query: Record<string, unknown>) => {
  const author = query.author;
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;
  const searchTerm = query.searchTerm as string | undefined;

  // ── Base match ─────────────────────────────────────────────────────────────
  const matchStage: Record<string, any> = { isDeleted: false };
  if (author) matchStage.author = new mongoose.Types.ObjectId(String(author));
  if (searchTerm) matchStage.name = { $regex: searchTerm, $options: 'i' };

  const [projects, countResult] = await Promise.all([
    Project.aggregate([
      { $match: matchStage },

      // ── Join latest WorkPhoto upload per project ───────────────────────────
      {
        $lookup: {
          from: 'workphotos',
          let: { projectId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$project', '$$projectId'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            { $project: { createdAt: 1 } },
          ],
          as: 'lastPhoto',
        },
      },

      // ── Count actual photos ────────────────────────────────────────────────
      {
        $lookup: {
          from: 'workphotos',
          localField: '_id',
          foreignField: 'project',
          as: 'allPhotos',
        },
      },

      {
        $addFields: {
          photosCount: { $size: '$allPhotos' },
          lastPhotoAt: {
            $ifNull: [
              { $arrayElemAt: ['$lastPhoto.createdAt', 0] },
              null,
            ],
          },
          // ── Sort key: photos uploaded → use lastPhotoAt, else createdAt ───
          sortKey: {
            $ifNull: [
              { $arrayElemAt: ['$lastPhoto.createdAt', 0] },
              '$createdAt',
            ],
          },
        },
      },

      // ── Clean up lookup arrays ─────────────────────────────────────────────
      { $unset: ['lastPhoto', 'allPhotos'] },

      // ── Sort: most recently active project first ───────────────────────────
      { $sort: { sortKey: -1 } },

      { $skip: skip },
      { $limit: limit },
    ]),

    Project.aggregate([
      { $match: matchStage },
      { $count: 'total' },
    ]),
  ]);

  const total = countResult[0]?.total ?? 0;

  // ── Fire-and-forget: fix stale photosCount in DB ───────────────────────────
  const stale = projects.filter(
    (p) => p.photosCount !== p.photosCount, // compare with DB value if needed
  );

  // Better stale check — compare aggregate count vs stored count
  Project.find({ _id: { $in: projects.map((p) => p._id) } })
    .select('photosCount')
    .lean()
    .then((dbProjects) => {
      const dbMap = new Map(dbProjects.map((p) => [p._id.toString(), p.photosCount]));
      const toFix = projects.filter(
        (p) => dbMap.get(p._id.toString()) !== p.photosCount,
      );
      if (toFix.length > 0) {
        Promise.all(
          toFix.map((p) =>
            Project.findByIdAndUpdate(p._id, { $set: { photosCount: p.photosCount } }),
          ),
        ).catch((err) =>
          console.error('[Projects] ⚠️ Failed to sync stale photosCount:', err),
        );
      }
    })
    .catch(() => {});

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    result: projects,
  };
};

const getAProjectsFromDB = async (id: string) => {
  const project = await Project.findById(id).populate([
    { path: 'author', select: 'name email photoUrl' },
  ])
  if (!project || project?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project record not found')
  }

  return project
}

const updateProjectFromDB = async (
  id: string,
  payload: Partial<TProject>,
  file?: any,
) => {
  const project = await Project.findById(id)
  if (!project || project?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project record not found')
  }

  const updatedProject = await Project.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!updatedProject) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Project record not updated',
    )
  }

  return updatedProject
}

const deleteAProjectFromDB = async (id: string) => {
  const project = await Project.findById(id)
  if (!project || project?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project record not found')
  }

  const result = await Project.findByIdAndUpdate(
    id,
    {
      isDeleted: true,
    },
    { new: true },
  )
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project record delete failed')
  }

  // Hard delete all work photos under project
  await WorkPhoto.deleteMany({ project: id })

  return result
}

export const ProjectService = {
  createProjectIntoDB,
  getAllProjectsFromDB,
  getAProjectsFromDB,
  updateProjectFromDB,
  deleteAProjectFromDB,
}
