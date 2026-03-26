{
 "cells": [
  {
   "cell_type": "code",
   "execution_count": null,
   "id": "b438579a",
   "metadata": {
    "vscode": {
     "languageId": "javascript"
    }
   },
   "outputs": [],
   "source": [
    "const mongoose = require(\"mongoose\");\n",
    "\n",
    "const userSchema = new mongoose.Schema({\n",
    "  // ... existing fields\n",
    "  // 2FA Fields\n",
    "  twoFactorSecret: {\n",
    "    type: String, // Store the secret key\n",
    "  },\n",
    "  isTwoFactorEnabled: {\n",
    "    type: Boolean,\n",
    "    default: false\n",
    "  },\n",
    "  twoFactorRecoveryCodes: [{\n",
    "    type: String // Optional: recovery codes\n",
    "  }],\n",
    "  // ...\n",
    "});\n"
   ]
  }
 ],
 "metadata": {
  "language_info": {
   "name": "python"
  }
 },
 "nbformat": 4,
 "nbformat_minor": 5
}
