const fs = require('fs');
const path = require('path');

class DynamicFunctionEngine {
  constructor() {
    this.functionRegistry = new Map();
    this.businessContext = null;
    this.customFunctions = new Map();
    this.functionTemplates = new Map();
    this.initializeCoreTemplates();
  }

  static get DOMAIN_SIGNAL_PATTERNS() {
    return {
      tax: ['tax', 'refund', 'return', 'notice', 'filing'],
      tax_resolution: ['notice', 'balance due', 'resolution', 'installment agreement', 'payment due'],
      bank: ['bank', 'account', 'card', 'checking', 'savings', 'debit', 'credit'],
      fraud: ['suspicious transaction', 'suspicious', 'fraud', 'unauthorized', 'chargeback', 'account takeover'],
      collections: ['collections', 'installment', 'payment due', 'past due', 'delinquent', 'promise to pay', 'hardship', 'dispute'],
      verification: ['verification', 'verify', 'identity', 'identity check', 'security code', 'otp'],
    };
  }

  // Initialize core function templates that can adapt to any business
  initializeCoreTemplates() {
    this.functionTemplates.set('inventory_check', {
      name: 'checkInventory',
      description: 'Check inventory/availability of products or services',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'Product or service to check' },
          variant: { type: 'string', description: 'Specific variant, model, or type' },
          location: { type: 'string', description: 'Location or store (if applicable)' }
        },
        required: ['item']
      },
      implementation: this.createInventoryFunction.bind(this)
    });

    this.functionTemplates.set('pricing_check', {
      name: 'checkPrice',
      description: 'Get pricing information for products or services',
      parameters: {
        type: 'object',
        properties: {
          item: { type: 'string', description: 'Product or service name' },
          variant: { type: 'string', description: 'Specific variant or package' },
          quantity: { type: 'integer', description: 'Quantity for bulk pricing' }
        },
        required: ['item']
      },
      implementation: this.createPricingFunction.bind(this)
    });

    this.functionTemplates.set('booking_scheduling', {
      name: 'scheduleAppointment',
      description: 'Schedule appointments or bookings',
      parameters: {
        type: 'object',
        properties: {
          service: { type: 'string', description: 'Service or appointment type' },
          date: { type: 'string', description: 'Preferred date' },
          time: { type: 'string', description: 'Preferred time' },
          duration: { type: 'integer', description: 'Duration in minutes' }
        },
        required: ['service', 'date', 'time']
      },
      implementation: this.createSchedulingFunction.bind(this)
    });

    this.functionTemplates.set('order_placement', {
      name: 'placeOrder',
      description: 'Place orders for products or services',
      parameters: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object' }, description: 'Array of items to order' },
          customerInfo: { type: 'object', description: 'Customer information' },
          paymentMethod: { type: 'string', description: 'Payment method' }
        },
        required: ['items']
      },
      implementation: this.createOrderFunction.bind(this)
    });

    this.functionTemplates.set('information_lookup', {
      name: 'lookupInformation',
      description: 'Look up detailed information about products, services, or policies',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'What to look up' },
          category: { type: 'string', description: 'Category or type of information' },
          details: { type: 'string', description: 'Specific details requested' }
        },
        required: ['topic']
      },
      implementation: this.createLookupFunction.bind(this)
    });

    this.functionTemplates.set('customer_support', {
      name: 'handleSupport',
      description: 'Handle customer support requests and issues',
      parameters: {
        type: 'object',
        properties: {
          issue: { type: 'string', description: 'Description of the issue' },
          category: { type: 'string', description: 'Issue category (technical, billing, etc.)' },
          urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Issue urgency' }
        },
        required: ['issue']
      },
      implementation: this.createSupportFunction.bind(this)
    });

    this.functionTemplates.set('lead_qualification', {
      name: 'qualifyLead',
      description: 'Qualify potential customers and gather requirements',
      parameters: {
        type: 'object',
        properties: {
          budget: { type: 'string', description: 'Budget range' },
          timeline: { type: 'string', description: 'When they need the solution' },
          requirements: { type: 'array', items: { type: 'string' }, description: 'List of requirements' }
        },
        required: ['budget']
      },
      implementation: this.createLeadQualificationFunction.bind(this)
    });

    this.functionTemplates.set('verify_identity', {
      name: 'verifyIdentity',
      description: 'Collect and confirm non-sensitive identity verification checkpoints before continuing',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string', description: 'Customer name as provided on the call' },
          verificationType: { type: 'string', enum: ['basic', 'step_up', 'document'], description: 'Verification path needed' },
          knownLast4: { type: 'string', description: 'Last four digits or similar limited identifier if allowed' }
        },
        required: ['verificationType']
      },
      implementation: this.createIdentityVerificationFunction.bind(this)
    });

    this.functionTemplates.set('create_callback_task', {
      name: 'createCallbackTask',
      description: 'Queue a callback task when the issue cannot be completed during the live call',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Reason a callback is needed' },
          priority: { type: 'string', enum: ['low', 'normal', 'high'], description: 'Operational priority' },
          requestedWindow: { type: 'string', description: 'Requested callback timing or window' }
        },
        required: ['reason']
      },
      implementation: this.createCallbackTaskFunction.bind(this)
    });

    this.functionTemplates.set('create_review_case', {
      name: 'createReviewCase',
      description: 'Create a manual review case for issues that need offline review instead of live transfer',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Reason the case should be reviewed' },
          category: { type: 'string', description: 'Operational case category' },
          priority: { type: 'string', enum: ['low', 'normal', 'high'], description: 'Review priority' }
        },
        required: ['reason']
      },
      implementation: this.createReviewCaseFunction.bind(this)
    });

    this.functionTemplates.set('send_secure_followup', {
      name: 'sendSecureFollowup',
      description: 'Send a secure follow-up instruction or link after the call',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: ['sms', 'email'], description: 'Preferred secure follow-up channel' },
          purpose: { type: 'string', description: 'Why the secure follow-up is being sent' },
          artifactType: { type: 'string', description: 'Type of secure link, form, or message to send' }
        },
        required: ['purpose']
      },
      implementation: this.createSecureFollowupFunction.bind(this)
    });

    this.functionTemplates.set('classify_tax_inquiry', {
      name: 'classifyTaxInquiry',
      description: 'Classify a tax inquiry into refund, notice, filing, or document follow-up categories',
      parameters: {
        type: 'object',
        properties: {
          inquirySummary: { type: 'string', description: 'Caller summary of the tax question' },
          mentionsNotice: { type: 'boolean', description: 'Whether the caller mentions a notice or letter' }
        },
        required: ['inquirySummary']
      },
      implementation: this.createTaxInquiryClassificationFunction.bind(this)
    });

    this.functionTemplates.set('classify_fraud_alert', {
      name: 'classifyFraudAlert',
      description: 'Classify a possible fraud report into blocked, review, or likely legitimate categories',
      parameters: {
        type: 'object',
        properties: {
          incidentSummary: { type: 'string', description: 'Summary of the suspicious activity' },
          accountChannel: { type: 'string', description: 'Card, account, login, or transfer channel involved' }
        },
        required: ['incidentSummary']
      },
      implementation: this.createFraudClassificationFunction.bind(this)
    });

    this.functionTemplates.set('capture_promise_to_pay', {
      name: 'capturePromiseToPay',
      description: 'Capture a caller commitment to pay by a specific date without taking payment live',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Promised amount' },
          paymentDate: { type: 'string', description: 'Promised payment date' },
          notes: { type: 'string', description: 'Collection notes or qualifiers' }
        },
        required: ['paymentDate']
      },
      implementation: this.createPromiseToPayFunction.bind(this)
    });

    this.functionTemplates.set('collect_document_checklist_status', {
      name: 'collectDocumentChecklistStatus',
      description: 'Capture which required documents are ready, missing, or pending follow-up',
      parameters: {
        type: 'object',
        properties: {
          checklistType: { type: 'string', description: 'Document checklist category' },
          completedItems: { type: 'array', items: { type: 'string' }, description: 'Items already completed' },
          missingItems: { type: 'array', items: { type: 'string' }, description: 'Items still missing' }
        },
        required: ['checklistType']
      },
      implementation: this.createDocumentChecklistFunction.bind(this)
    });

    this.functionTemplates.set('offer_payment_arrangement', {
      name: 'offerPaymentArrangement',
      description: 'Present a compliant payment arrangement option without taking payment live',
      parameters: {
        type: 'object',
        properties: {
          balance: { type: 'number', description: 'Outstanding balance' },
          preferredPlan: { type: 'string', description: 'Requested plan cadence or structure' },
          hardshipFlag: { type: 'boolean', description: 'Whether hardship was mentioned' }
        },
        required: ['balance']
      },
      implementation: this.createPaymentArrangementFunction.bind(this)
    });

    this.functionTemplates.set('lookup_policy_answer', {
      name: 'lookupPolicyAnswer',
      description: 'Look up a policy-safe answer for servicing, tax, or bank questions',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Policy or servicing topic' },
          policyType: { type: 'string', description: 'Category of policy guidance needed' }
        },
        required: ['topic']
      },
      implementation: this.createPolicyLookupFunction.bind(this)
    });

    this.functionTemplates.set('schedule_consultation', {
      name: 'scheduleConsultation',
      description: 'Schedule a follow-up consultation or specialist review slot without live transfer',
      parameters: {
        type: 'object',
        properties: {
          consultationType: { type: 'string', description: 'Type of consultation requested' },
          preferredDate: { type: 'string', description: 'Preferred follow-up date' },
          preferredWindow: { type: 'string', description: 'Preferred time window' }
        },
        required: ['consultationType']
      },
      implementation: this.createConsultationFunction.bind(this)
    });

    this.functionTemplates.set('capture_dispute_reason', {
      name: 'captureDisputeReason',
      description: 'Capture the stated reason for a collections or transaction dispute',
      parameters: {
        type: 'object',
        properties: {
          disputeReason: { type: 'string', description: 'Caller-stated reason for dispute' },
          category: { type: 'string', description: 'Dispute category' },
          requestedResolution: { type: 'string', description: 'What outcome the caller wants' }
        },
        required: ['disputeReason']
      },
      implementation: this.createDisputeReasonFunction.bind(this)
    });
  }

  // Analyze business context from prompt and generate appropriate functions
  generateFunctionsFromPrompt(prompt, firstMessage) {
    const analysis = this.analyzeBusinessContext(prompt, firstMessage);
    this.businessContext = analysis;
    
    console.log(`Detected business context: ${analysis.industry} - ${analysis.businessType}`.cyan);
    console.log(`📋 Suggested functions: ${analysis.suggestedFunctions.join(', ')}`.blue);

    const functions = [];
    const functionImplementations = {};

    // Generate functions based on detected context
    analysis.suggestedFunctions.forEach(functionType => {
      if (this.functionTemplates.has(functionType)) {
        const template = this.functionTemplates.get(functionType);
        const adaptedFunction = this.adaptFunctionToContext(template, analysis);
        
        functions.push(adaptedFunction.manifest);
        functionImplementations[adaptedFunction.name] = adaptedFunction.implementation;
      }
    });

    return {
      functions,
      implementations: functionImplementations,
      context: analysis
    };
  }

  // Analyze business context from prompt
  analyzeBusinessContext(prompt, firstMessage) {
    const combinedText = `${prompt} ${firstMessage}`.toLowerCase();
    
    const analysis = {
      industry: 'general',
      businessType: 'sales',
      products: [],
      services: [],
      suggestedFunctions: [],
      keyTerms: [],
      customerActions: [],
      detectedDomains: [],
      domainScores: {}
    };

    // Industry detection
    const industryPatterns = {
      'retail': ['store', 'shop', 'buy', 'purchase', 'product', 'sale', 'discount'],
      'healthcare': ['appointment', 'doctor', 'medical', 'health', 'clinic', 'patient'],
      'real_estate': ['property', 'house', 'apartment', 'rent', 'mortgage', 'real estate'],
      'automotive': ['car', 'vehicle', 'auto', 'dealership', 'lease', 'finance'],
      'technology': ['software', 'app', 'tech', 'digital', 'platform', 'system'],
      'finance': ['loan', 'investment', 'insurance', 'bank', 'credit', 'financial'],
      'education': ['course', 'training', 'learn', 'education', 'school', 'certification'],
      'food_service': ['restaurant', 'food', 'delivery', 'menu', 'order', 'reservation']
    };

    for (const [industry, keywords] of Object.entries(industryPatterns)) {
      const matches = keywords.filter(keyword => combinedText.includes(keyword));
      if (matches.length >= 2) {
        analysis.industry = industry;
        analysis.keyTerms.push(...matches);
        break;
      }
    }

    // Business type detection
    if (combinedText.includes('appointment') || combinedText.includes('schedule') || combinedText.includes('booking')) {
      analysis.businessType = 'appointment_based';
      analysis.suggestedFunctions.push('booking_scheduling');
    }
    
    if (combinedText.includes('sell') || combinedText.includes('buy') || combinedText.includes('purchase')) {
      analysis.businessType = 'sales';
      analysis.suggestedFunctions.push('inventory_check', 'pricing_check', 'order_placement');
    }
    
    if (combinedText.includes('support') || combinedText.includes('help') || combinedText.includes('issue')) {
      analysis.suggestedFunctions.push('customer_support');
    }

    this.applyOperationalDomainAnalysis(analysis, combinedText);

    // Always include information lookup for flexibility
    analysis.suggestedFunctions.push('information_lookup');

    // Add lead qualification for sales contexts
    if (analysis.businessType === 'sales') {
      analysis.suggestedFunctions.push('lead_qualification');
    }

    // Extract products/services mentioned
    const productPatterns = [
      /selling\s+([a-zA-Z\s]+?)(?:\.|,|$)/g,
      /offering\s+([a-zA-Z\s]+?)(?:\.|,|$)/g,
      /about\s+([a-zA-Z\s]+?)(?:\.|,|$)/g
    ];

    productPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(combinedText)) !== null) {
        if (match[1] && match[1].trim().length > 2) {
          analysis.products.push(match[1].trim());
        }
      }
    });

    analysis.suggestedFunctions = Array.from(new Set(analysis.suggestedFunctions));
    analysis.keyTerms = Array.from(new Set(analysis.keyTerms));

    return analysis;
  }

  applyOperationalDomainAnalysis(analysis, combinedText) {
    const scores = {};
    const signalPatterns = DynamicFunctionEngine.DOMAIN_SIGNAL_PATTERNS;
    Object.entries(signalPatterns).forEach(([key, keywords]) => {
      const matches = keywords.filter(keyword => combinedText.includes(keyword));
      scores[key] = matches.length;
      if (matches.length > 0) {
        analysis.keyTerms.push(...matches);
      }
    });

    analysis.domainScores = scores;

    if (scores.tax > 0) {
      const taxDomain = scores.tax_resolution >= 2 ? 'tax_resolution' : 'tax_support';
      analysis.detectedDomains.push(taxDomain);
      analysis.industry = 'finance';
      analysis.businessType = taxDomain;
      this.addSuggestedFunctions(
        analysis,
        'classify_tax_inquiry',
        'lookup_policy_answer',
        'collect_document_checklist_status'
      );
      if (taxDomain === 'tax_resolution') {
        this.addSuggestedFunctions(analysis, 'create_review_case', 'schedule_consultation');
      } else {
        this.addSuggestedFunctions(analysis, 'create_callback_task');
      }
    }

    if (scores.bank > 0) {
      analysis.detectedDomains.push('bank_servicing');
      analysis.industry = 'finance';
      if (analysis.businessType === 'sales') {
        analysis.businessType = 'bank_servicing';
      }
      this.addSuggestedFunctions(
        analysis,
        'verify_identity',
        'lookup_policy_answer',
        'send_secure_followup'
      );
      if (combinedText.includes('card') || combinedText.includes('account')) {
        this.addSuggestedFunctions(analysis, 'create_callback_task');
      }
    }

    if (scores.fraud > 0) {
      analysis.detectedDomains.push('fraud_review');
      analysis.industry = 'finance';
      analysis.businessType = 'fraud_review';
      this.addSuggestedFunctions(
        analysis,
        'verify_identity',
        'classify_fraud_alert',
        'create_review_case',
        'send_secure_followup'
      );
    }

    if (scores.collections > 0) {
      analysis.detectedDomains.push('collections_servicing');
      analysis.industry = 'finance';
      analysis.businessType = 'collections_servicing';
      this.addSuggestedFunctions(
        analysis,
        'verify_identity',
        'offer_payment_arrangement',
        'capture_promise_to_pay',
        'capture_dispute_reason'
      );
      if (combinedText.includes('installment') || combinedText.includes('payment due')) {
        this.addSuggestedFunctions(analysis, 'create_callback_task');
      }
      if (combinedText.includes('dispute') || combinedText.includes('hardship')) {
        this.addSuggestedFunctions(analysis, 'create_review_case');
      }
    }

    if (scores.verification > 0) {
      analysis.detectedDomains.push('identity_verification_plus');
      if (analysis.industry === 'general') {
        analysis.industry = 'finance';
      }
      if (analysis.businessType === 'sales') {
        analysis.businessType = 'identity_verification_plus';
      }
      this.addSuggestedFunctions(
        analysis,
        'verify_identity',
        'send_secure_followup'
      );
      if (combinedText.includes('document') || combinedText.includes('unable to verify')) {
        this.addSuggestedFunctions(analysis, 'create_review_case');
      }
    }

    analysis.detectedDomains = Array.from(new Set(analysis.detectedDomains));
  }

  addSuggestedFunctions(analysis, ...functionTypes) {
    functionTypes.forEach(functionType => {
      if (!analysis.suggestedFunctions.includes(functionType)) {
        analysis.suggestedFunctions.push(functionType);
      }
    });
  }

  // Adapt function template to specific business context
  adaptFunctionToContext(template, context) {
    const adaptedFunction = { ...template };
    
    // Customize function name and description based on context
    switch (context.industry) {
      case 'healthcare':
        if (template.name === 'checkInventory') {
          adaptedFunction.name = 'checkAvailability';
          adaptedFunction.description = 'Check appointment availability or service capacity';
        }
        break;
      
      case 'real_estate':
        if (template.name === 'checkInventory') {
          adaptedFunction.name = 'checkProperties';
          adaptedFunction.description = 'Check available properties matching criteria';
        }
        break;
      
      case 'automotive':
        if (template.name === 'checkInventory') {
          adaptedFunction.description = 'Check vehicle inventory and availability';
        }
        break;
    }

    // Create the function manifest
    const manifest = {
      type: 'function',
      function: {
        name: adaptedFunction.name,
        say: this.generateSayMessage(adaptedFunction.name),
        description: adaptedFunction.description,
        parameters: adaptedFunction.parameters,
        returns: this.generateReturnSchema(adaptedFunction.name)
      }
    };

    return {
      name: adaptedFunction.name,
      manifest,
      implementation: adaptedFunction.implementation(context)
    };
  }

  // Generate appropriate "say" messages based on context
  generateSayMessage(functionName) {
    const messages = {
      'checkInventory': 'Let me check what we have available for you.',
      'checkPrice': 'Let me get you the current pricing information.',
      'scheduleAppointment': 'Let me check our schedule and book that for you.',
      'placeOrder': 'Perfect! Let me process that order for you.',
      'lookupInformation': 'Let me look up those details for you.',
      'handleSupport': 'I\'ll help you resolve that issue right away.',
      'qualifyLead': 'Let me gather some information to better assist you.',
      'checkAvailability': 'Let me check our availability for you.',
      'checkProperties': 'Let me search our property listings.',
      'verifyIdentity': 'I need to confirm a few identity details before we continue.',
      'createCallbackTask': 'I can queue a callback so this is handled safely offline.',
      'createReviewCase': 'I can create a review case for follow-up after this call.',
      'sendSecureFollowup': 'I can send a secure follow-up with the next steps.',
      'classifyTaxInquiry': 'Let me classify that tax issue so I can guide the next step.',
      'classifyFraudAlert': 'Let me categorize that fraud concern carefully.',
      'capturePromiseToPay': 'I can record that payment commitment for follow-up.',
      'collectDocumentChecklistStatus': 'Let me capture which documents are ready and which are still missing.',
      'offerPaymentArrangement': 'Let me review the available payment arrangement options.',
      'lookupPolicyAnswer': 'Let me check the policy-safe guidance for that question.',
      'scheduleConsultation': 'I can schedule a follow-up consultation for that request.',
      'captureDisputeReason': 'Let me capture the dispute details accurately.'
    };

    return messages[functionName] || 'One moment please, let me help you with that.';
  }

  // Generate return schema based on function type
  generateReturnSchema(functionName) {
    const schemas = {
      'checkInventory': {
        type: 'object',
        properties: {
          available: { type: 'boolean', description: 'Whether item is available' },
          quantity: { type: 'integer', description: 'Available quantity' },
          locations: { type: 'array', description: 'Available locations' }
        }
      },
      'checkPrice': {
        type: 'object',
        properties: {
          price: { type: 'number', description: 'Price of the item' },
          currency: { type: 'string', description: 'Currency code' },
          discounts: { type: 'array', description: 'Available discounts' }
        }
      },
      'placeOrder': {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'Order confirmation ID' },
          total: { type: 'number', description: 'Total order amount' },
          deliveryDate: { type: 'string', description: 'Expected delivery date' }
        }
      },
      'verifyIdentity': {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Verification outcome' },
          verificationType: { type: 'string', description: 'Applied verification path' },
          nextStep: { type: 'string', description: 'Next recommended step' }
        }
      },
      'createCallbackTask': {
        type: 'object',
        properties: {
          callbackTaskId: { type: 'string', description: 'Callback task identifier' },
          status: { type: 'string', description: 'Queued status' },
          requestedWindow: { type: 'string', description: 'Requested callback window' }
        }
      },
      'createReviewCase': {
        type: 'object',
        properties: {
          reviewCaseId: { type: 'string', description: 'Review case identifier' },
          status: { type: 'string', description: 'Case status' },
          category: { type: 'string', description: 'Review case category' }
        }
      }
    };

    return schemas[functionName] || {
      type: 'object',
      properties: {
        result: { type: 'string', description: 'Function execution result' },
        success: { type: 'boolean', description: 'Whether operation was successful' }
      }
    };
  }

  // Implementation generators for different function types
  createInventoryFunction(context) {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'checkInventory'} function`);
      
      const { item, variant, location } = functionArgs;
      
      // Dynamic inventory logic based on context
      const mockInventory = {
        'retail': () => Math.floor(Math.random() * 50) + 1,
        'automotive': () => Math.floor(Math.random() * 10) + 1,
        'real_estate': () => Math.floor(Math.random() * 5) + 1,
        'default': () => Math.floor(Math.random() * 100) + 1
      };

      const quantity = mockInventory[context.industry] ? 
        mockInventory[context.industry]() : 
        mockInventory.default();

      return JSON.stringify({
        available: quantity > 0,
        quantity: quantity,
        item: item,
        variant: variant || 'standard',
        location: location || 'main location'
      });
    };
  }

  createPricingFunction(context) {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'checkPrice'} function`);
      
      const { item, variant, quantity = 1 } = functionArgs;
      
      // Dynamic pricing based on context
      const basePrices = {
        'retail': () => Math.floor(Math.random() * 500) + 50,
        'automotive': () => Math.floor(Math.random() * 50000) + 15000,
        'real_estate': () => Math.floor(Math.random() * 500000) + 200000,
        'healthcare': () => Math.floor(Math.random() * 300) + 100,
        'default': () => Math.floor(Math.random() * 1000) + 100
      };

      const basePrice = basePrices[context.industry] ? 
        basePrices[context.industry]() : 
        basePrices.default();

      const totalPrice = basePrice * quantity;
      
      return JSON.stringify({
        price: totalPrice,
        basePrice: basePrice,
        quantity: quantity,
        currency: 'USD',
        item: item,
        variant: variant || 'standard'
      });
    };
  }

  createSchedulingFunction(context) {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'scheduleAppointment'} function`);
      
      const { service, date, time, duration = 30 } = functionArgs;
      
      // Generate confirmation ID
      const confirmationId = `${context.industry.toUpperCase()}-${Date.now().toString().slice(-6)}`;
      
      return JSON.stringify({
        confirmed: true,
        confirmationId: confirmationId,
        service: service,
        scheduledDate: date,
        scheduledTime: time,
        duration: duration,
        location: context.industry === 'healthcare' ? 'Main Clinic' : 'Main Office'
      });
    };
  }

  createOrderFunction(context) {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'placeOrder'} function`);
      
      const { items, paymentMethod = 'card' } = functionArgs;
      
      const orderId = `ORD-${Date.now().toString().slice(-8).toUpperCase()}`;
      const total = Math.floor(Math.random() * 1000) + 100; // Mock total
      
      return JSON.stringify({
        success: true,
        orderId: orderId,
        total: total,
        currency: 'USD',
        items: items,
        paymentMethod: paymentMethod,
        estimatedDelivery: context.industry === 'food_service' ? '30-45 minutes' : '3-5 business days'
      });
    };
  }

  createLookupFunction(context) {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'lookupInformation'} function`);
      
      const { topic, category } = functionArgs;
      
      // Context-specific information responses
      const responses = {
        'healthcare': `Based on your inquiry about ${topic}, here are the details: Our medical services include comprehensive care with qualified professionals. Please consult with our staff for specific medical advice.`,
        'automotive': `Regarding ${topic}, here's what you need to know: Our vehicles come with comprehensive warranties and financing options. All models include standard safety features and optional upgrades.`,
        'real_estate': `About ${topic}: Our properties feature modern amenities and are located in desirable neighborhoods. We offer various financing options and can arrange property tours.`,
        'default': `Here's the information about ${topic}: We provide comprehensive services with competitive pricing and excellent customer support. Contact us for detailed specifications.`
      };

      const response = responses[context.industry] || responses.default;
      
      return JSON.stringify({
        information: response,
        topic: topic,
        category: category || 'general',
        additionalResources: ['Contact our specialist', 'Schedule a consultation', 'View detailed brochure']
      });
    };
  }

  createSupportFunction() {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'handleSupport'} function`);
      
      const { issue, category = 'general', urgency = 'medium' } = functionArgs;
      
      const ticketId = `SUP-${Date.now().toString().slice(-6)}`;
      
      return JSON.stringify({
        ticketId: ticketId,
        issue: issue,
        category: category,
        urgency: urgency,
        status: 'acknowledged',
        nextSteps: urgency === 'high' ? 
          'Escalating to senior specialist immediately' : 
          'We will resolve this within 24 hours',
        estimatedResolution: urgency === 'high' ? '1 hour' : '24 hours'
      });
    };
  }

  createLeadQualificationFunction() {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'qualifyLead'} function`);
      
      const { budget, timeline, requirements = [] } = functionArgs;
      
      // Calculate qualification score based on inputs
      let score = 0;
      if (budget && !budget.toLowerCase().includes('low')) score += 30;
      if (timeline && timeline.toLowerCase().includes('soon')) score += 20;
      if (requirements.length > 0) score += 25;
      score += 25; // Base score for engagement
      
      const qualification = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
      
      return JSON.stringify({
        qualificationScore: score,
        qualification: qualification,
        budget: budget,
        timeline: timeline,
        requirements: requirements,
        recommendedNextStep: qualification === 'high' ? 
          'Schedule immediate consultation' : 
          'Provide detailed information package'
      });
    };
  }

  createIdentityVerificationFunction(context) {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'verifyIdentity'} function`);

      const verificationType = functionArgs.verificationType || 'basic';
      const nextStep = verificationType === 'document'
        ? 'send_secure_followup'
        : verificationType === 'step_up'
          ? 'create_review_case'
          : 'continue_call';

      return JSON.stringify({
        status: verificationType === 'step_up' ? 'additional_review_needed' : 'verified',
        verificationType,
        customerName: functionArgs.customerName || null,
        nextStep,
        domain: context.businessType || context.industry || 'general'
      });
    };
  }

  createCallbackTaskFunction(context) {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'createCallbackTask'} function`);

      return JSON.stringify({
        callbackTaskId: `CB-${Date.now().toString().slice(-8)}`,
        status: 'queued',
        requestedWindow: functionArgs.requestedWindow || 'next_available_window',
        priority: functionArgs.priority || 'normal',
        reason: functionArgs.reason,
        domain: context.businessType || context.industry || 'general'
      });
    };
  }

  createReviewCaseFunction(context) {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'createReviewCase'} function`);

      return JSON.stringify({
        reviewCaseId: `RC-${Date.now().toString().slice(-8)}`,
        status: 'open',
        category: functionArgs.category || context.businessType || 'general_review',
        priority: functionArgs.priority || 'normal',
        reason: functionArgs.reason
      });
    };
  }

  createSecureFollowupFunction(context) {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'sendSecureFollowup'} function`);

      return JSON.stringify({
        status: 'sent',
        channel: functionArgs.channel || 'sms',
        artifactType: functionArgs.artifactType || 'secure_link',
        purpose: functionArgs.purpose,
        domain: context.businessType || context.industry || 'general'
      });
    };
  }

  createTaxInquiryClassificationFunction() {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'classifyTaxInquiry'} function`);

      const summary = String(functionArgs.inquirySummary || '').toLowerCase();
      const category = functionArgs.mentionsNotice || summary.includes('notice')
        ? 'notice'
        : summary.includes('refund')
          ? 'refund'
          : summary.includes('document') || summary.includes('checklist')
            ? 'document_follow_up'
            : 'general_tax_support';

      return JSON.stringify({
        category,
        requiresReview: category === 'notice',
        recommendedNextStep: category === 'notice' ? 'create_review_case' : 'lookup_policy_answer'
      });
    };
  }

  createFraudClassificationFunction() {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'classifyFraudAlert'} function`);

      const summary = String(functionArgs.incidentSummary || '').toLowerCase();
      const severity = summary.includes('unauthorized') || summary.includes('takeover')
        ? 'high'
        : summary.includes('suspicious')
          ? 'medium'
          : 'low';

      return JSON.stringify({
        severity,
        disposition: severity === 'high' ? 'review_required' : severity === 'medium' ? 'step_up_verification' : 'customer_confirmed_legitimate',
        accountChannel: functionArgs.accountChannel || 'unspecified'
      });
    };
  }

  createPromiseToPayFunction() {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'capturePromiseToPay'} function`);

      return JSON.stringify({
        status: 'captured',
        amount: functionArgs.amount || null,
        paymentDate: functionArgs.paymentDate,
        notes: functionArgs.notes || '',
        nextStep: 'callback_follow_up'
      });
    };
  }

  createDocumentChecklistFunction() {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'collectDocumentChecklistStatus'} function`);

      const completedItems = Array.isArray(functionArgs.completedItems) ? functionArgs.completedItems : [];
      const missingItems = Array.isArray(functionArgs.missingItems) ? functionArgs.missingItems : [];

      return JSON.stringify({
        checklistType: functionArgs.checklistType,
        completedCount: completedItems.length,
        missingCount: missingItems.length,
        status: missingItems.length > 0 ? 'follow_up_needed' : 'complete'
      });
    };
  }

  createPaymentArrangementFunction() {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'offerPaymentArrangement'} function`);

      const planType = functionArgs.hardshipFlag ? 'hardship_review' : 'standard_installment';
      return JSON.stringify({
        eligible: true,
        planType,
        balance: functionArgs.balance,
        preferredPlan: functionArgs.preferredPlan || 'monthly',
        nextStep: functionArgs.hardshipFlag ? 'create_review_case' : 'capture_promise_to_pay'
      });
    };
  }

  createPolicyLookupFunction(context) {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'lookupPolicyAnswer'} function`);

      const topic = functionArgs.topic || 'general';
      return JSON.stringify({
        topic,
        policyType: functionArgs.policyType || context.businessType || 'general_policy',
        answer: `Policy guidance is available for ${topic}; confirm the caller's situation and use secure follow-up for sensitive next steps.`,
        safeNextStep: 'send_secure_followup'
      });
    };
  }

  createConsultationFunction(context) {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'scheduleConsultation'} function`);

      return JSON.stringify({
        scheduled: true,
        consultationId: `CONS-${Date.now().toString().slice(-8)}`,
        consultationType: functionArgs.consultationType,
        preferredDate: functionArgs.preferredDate || 'next_available_date',
        preferredWindow: functionArgs.preferredWindow || 'business_hours',
        domain: context.businessType || context.industry || 'general'
      });
    };
  }

  createDisputeReasonFunction() {
    return async function(functionArgs) {
      console.log(`GPT -> called ${this.name || 'captureDisputeReason'} function`);

      return JSON.stringify({
        status: 'captured',
        disputeReason: functionArgs.disputeReason,
        category: functionArgs.category || 'general_dispute',
        requestedResolution: functionArgs.requestedResolution || 'manual_review',
        nextStep: 'create_review_case'
      });
    };
  }

  // Save generated functions to files
  saveGeneratedFunctions(functions, implementations, outputDir = './functions') {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save function manifest
    const manifestPath = path.join(outputDir, 'function-manifest.js');
    const manifestContent = `// Auto-generated function manifest
const tools = ${JSON.stringify(functions, null, 2)};

module.exports = tools;`;
    
    fs.writeFileSync(manifestPath, manifestContent);

    // Save individual function implementations
    Object.entries(implementations).forEach(([name, implementation]) => {
      const functionPath = path.join(outputDir, `${name}.js`);
      const functionContent = `// Auto-generated function: ${name}
${implementation.toString()}

module.exports = ${name};`;
      
      fs.writeFileSync(functionPath, functionContent);
    });

    console.log(`✅ Generated ${Object.keys(implementations).length} functions saved to ${outputDir}`.green);
  }

  // Main method to generate complete function system
  generateAdaptiveFunctionSystem(prompt, firstMessage, outputDir) {
    console.log('🚀 Generating adaptive function system...'.blue);
    
    const result = this.generateFunctionsFromPrompt(prompt, firstMessage);
    
    if (outputDir) {
      this.saveGeneratedFunctions(result.functions, result.implementations, outputDir);
    }
    
    console.log(`✅ Generated ${result.functions.length} adaptive functions for ${result.context.industry} industry`.green);
    
    return result;
  }

  // Get business analysis report
  getBusinessAnalysis() {
    return {
      detectedContext: this.businessContext,
      availableTemplates: Array.from(this.functionTemplates.keys()),
      generatedFunctions: Array.from(this.functionRegistry.keys())
    };
  }

  getSecureInputHints(context = null) {
    const resolvedContext = context || this.businessContext || {};
    const industry = resolvedContext.industry || 'general';
    const businessLabel =
      resolvedContext.businessDisplayName ||
      resolvedContext.companyName ||
      resolvedContext.brand ||
      'our team';

    const hints = {};

    if (industry === 'finance' || resolvedContext.businessType === 'banking') {
      hints.OTP = `It is the 6-digit security code sent to protect the ${businessLabel} account.`;
      hints.PIN = `Use the PIN you set when opening your ${businessLabel} profile.`;
      hints.CARD_LAST4 = `Only the last four digits of the ${businessLabel} card are required.`;
    } else if (industry === 'healthcare') {
      hints.OTP = `This code confirms access to your ${businessLabel} health portal.`;
      hints.PIN = `Use the clinic PIN associated with your ${businessLabel} file.`;
    } else if (industry === 'real_estate' || industry === 'automotive') {
      hints.OTP = `It verifies your ${businessLabel} inquiry; check the text we just sent.`;
      hints.PIN = `This is the application PIN tied to your ${businessLabel} request.`;
    } else {
      hints.OTP = `This keeps your ${businessLabel} experience secure; enter the code we texted.`;
      hints.PIN = `Use the short PIN you chose with ${businessLabel}.`;
    }

    return hints;
  }
}

module.exports = DynamicFunctionEngine;
