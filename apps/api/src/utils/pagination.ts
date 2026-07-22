/**
 * Pagination and request utilities
 */

import { PaginationParams, ApiResponse } from '@/types';
import { errorResponses } from './errors';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const parsePagination = (
  page?: string | number,
  limit?: string | number
): PaginationParams => {
  let parsedPage = parseInt(String(page || DEFAULT_PAGE), 10);
  let parsedLimit = parseInt(String(limit || DEFAULT_LIMIT), 10);

  // Validation
  if (isNaN(parsedPage) || parsedPage < 1) parsedPage = DEFAULT_PAGE;
  if (isNaN(parsedLimit) || parsedLimit < 1) parsedLimit = DEFAULT_LIMIT;
  if (parsedLimit > MAX_LIMIT) parsedLimit = MAX_LIMIT;

  return {
    page: parsedPage,
    limit: parsedLimit,
  };
};

export const calculatePagination = (total: number, page: number, limit: number) => {
  return {
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    timestamp: new Date().toISOString(),
  };
};

export const createPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): ApiResponse<T[]> => {
  return {
    data,
    meta: calculatePagination(total, page, limit),
  };
};

export const calculateSkip = (page: number, limit: number): number => {
  return (page - 1) * limit;
};

export interface QueryFilters {
  guildId?: string;
  userId?: string;
  action?: string;
  severity?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export const parseFilters = (query: any): QueryFilters => {
  const filters: QueryFilters = {};

  if (query.guildId && typeof query.guildId === 'string') {
    filters.guildId = query.guildId;
  }

  if (query.userId && typeof query.userId === 'string') {
    filters.userId = query.userId;
  }

  if (query.action && typeof query.action === 'string') {
    filters.action = query.action;
  }

  if (query.severity && typeof query.severity === 'string') {
    filters.severity = query.severity;
  }

  if (query.search && typeof query.search === 'string') {
    filters.search = query.search;
  }

  if (query.dateFrom) {
    const dateFrom = new Date(query.dateFrom);
    if (!isNaN(dateFrom.getTime())) {
      filters.dateFrom = dateFrom;
    }
  }

  if (query.dateTo) {
    const dateTo = new Date(query.dateTo);
    if (!isNaN(dateTo.getTime())) {
      filters.dateTo = dateTo;
    }
  }

  return filters;
};
