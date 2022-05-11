import { DietaryCategory, DietaryMatcher, DietaryName } from '.';

export class DietaryHelper {
  private readonly dietaryMap: DietaryMatcher = { map: [] };

  constructor() {
    this.initDietaryMap();
  }

  get(): DietaryMatcher {
    return this.dietaryMap;
  }

  private initDietaryMap() {
    this.dietaryMap.map.push({
      key: DietaryCategory.adverseReaction,
      values: [DietaryName.lowLactose, DietaryName.glutenFree, DietaryName.lactoseFree],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.cultural,
      values: [DietaryName.cantonese, DietaryName.hindu, DietaryName.kosher, DietaryName.halalMeat],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.diabetic,
      values: [DietaryName.diabetic, DietaryName.maternalDiabetic],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.fiber,
      values: [DietaryName.highFiber, DietaryName.lowFiber],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.fluidRestrictions,
      values: [
        DietaryName.fluidRestriction1500ml,
        DietaryName.fluidRestriction,
        DietaryName.fluidIncreased,
      ],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.fluid,
      values: [DietaryName.clearFluids, DietaryName.fullFluids],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.heartHealthy,
      values: [
        DietaryName.cardiac,
        DietaryName.lowCholesterol,
        DietaryName.dietaryApproachesToStopHypertension,
        DietaryName.lowFat,
      ],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.house,
      values: [DietaryName.regularMaternal, DietaryName.vegetarian, DietaryName.vegan],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.medication,
      values: [DietaryName.decreasedTyramine, DietaryName.VitaminKRestriction],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.mineral,
      values: [
        DietaryName.increasedIron,
        DietaryName.decreasedCalcium,
        DietaryName.increasedCalcium,
        DietaryName.decreasedIron,
      ],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.other,
      values: [DietaryName.lowCarbohydrate, DietaryName.lowProtein, DietaryName.fasting],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.renal,
      values: [
        DietaryName.lowPotassium,
        DietaryName.chronicKidneyDiseaseHemodialysis,
        DietaryName.acuteRenalFailurePeritonealDialysisRenalTransplant,
      ],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.sodiumRestricted,
      values: [DietaryName.lowSodium],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.surgery,
      values: [DietaryName.bariatricSurgery],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.textureModified,
      values: [DietaryName.easyToChew, DietaryName.mechanicallyAltered, DietaryName.pureed],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.therapeutic,
      values: [
        DietaryName.antiReflux,
        DietaryName.lowCalorie,
        DietaryName.dietaryTreatmentForDisorder,
        DietaryName.highCalorieAndHighProtein,
      ],
    });
    this.dietaryMap.map.push({
      key: DietaryCategory.weightReduction,
      values: [DietaryName.atkins, DietaryName.keto, DietaryName.paleo],
    });
  }
}
