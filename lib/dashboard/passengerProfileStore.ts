/**
 * @deprecated Import from `@/lib/dashboard/travelerProfileStore` instead.
 */
export {
  ensureTravelerProfile,
  ensureTravelerProfile as ensurePassengerProfile,
  getTravelerProfileForUser,
  getTravelerProfileForUser as getPassengerProfileForUser,
  listTravelerProfilesForUser,
  listTravelerProfilesForUser as listPassengerProfilesForUser,
  listProfilesByIds,
  updateTravelerProfileFields,
  updateTravelerProfileFields as updatePassengerProfileFields,
  deleteBlankTravelerProfiles,
  IncompleteTravelerIdentityError,
  type ProfileTravellerInput,
  type UpdateTravelerProfileFieldsInput,
  type UpdateTravelerProfileFieldsInput as UpdatePassengerProfileFieldsInput,
} from '@/lib/dashboard/travelerProfileStore';
